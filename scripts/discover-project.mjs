#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readProjectConfig, updateProjectStage } from "./lib/project-state.mjs";

const ASSET_EXTENSIONS = "png|jpe?g|webp|avif|gif|svg|mp4|webm|mov|mp3|wav|ogg|glb|gltf|obj|fbx|hdr|exr|ktx2?|woff2?|ttf|otf|ico";
const INSPIRATION_PROVIDERS = Object.freeze([
  ["recent-design", "https://recent.design/", "综合网页、品牌、字体与动效"],
  ["lapa-ninja", "https://www.lapa.ninja/search/?q={query}", "落地页、行业、颜色与建站工具"],
  ["land-book", "https://land-book.com/websites?search={query}", "商业网站、落地页与作品集"],
  ["siteinspire", "https://www.siteinspire.com/search/websites?search={query}", "精选网站与工作室案例"],
  ["awwwards", "https://www.awwwards.com/websites/?text={query}", "高创意、高动效与技术型网站"],
  ["the-fwa", "https://thefwa.com/search?search={query}", "获奖数字体验与实验性交互"],
  ["mesh3d", "https://mesh3d.gallery/", "Three.js、WebGL 与交互式 3D 网站"],
  ["mobbin", "https://mobbin.com/browse/web/apps", "真实产品界面与完整流程"],
  ["refero", "https://refero.design/", "真实产品页面与 SaaS 组件"],
  ["design-spells", "https://www.designspells.com/", "微交互、彩蛋与精致细节"],
  ["details-inspo", "https://www.details.so/inspo", "Hero、Footer、Preloader 与页面转场"],
  ["supahero", "https://supahero.io/", "Hero 首屏"],
  ["navbar-gallery", "https://www.navbar.gallery/", "导航栏与菜单"],
  ["cta-gallery", "https://www.cta.gallery/", "CTA 区块与文案"],
  ["footer-design", "https://www.footer.design/", "网站页脚"],
  ["loadmore", "https://loadmo.re/", "实验型移动网站"],
]);

function usage() {
  console.log(`Usage:
  node scripts/discover-project.mjs --project <dir> [options]

Options:
  --scope <code,asset,inspiration>  Default: all three scopes
  --query <text>                    Repeat to add explicit identity/search terms
  --limit <n>                       Maximum candidates per scope (default: 12)
  --offline                         Skip GitHub/npm network adapters
  --apply                           Persist .clone/evidence/discovery.json
  --json                            Emit the complete report as JSON

Discovery produces ranked candidates, not verified provenance. Adopt a code or
asset candidate with yah source, or record a bounded code no-match, before
completing source_discovery.
`);
}

function parseArgs(argv) {
  const out = { project: "", scopes: ["code", "asset", "inspiration"], queries: [], limit: 12, offline: false, apply: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--scope") out.scopes = String(argv[++i] || "").split(",").map((value) => value.trim()).filter(Boolean);
    else if (arg === "--query") out.queries.push(argv[++i] || "");
    else if (arg === "--limit") out.limit = Number(argv[++i]);
    else if (arg === "--offline") out.offline = true;
    else if (arg === "--apply") out.apply = true;
    else if (arg === "--json") out.json = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  const invalid = out.scopes.filter((scope) => !["code", "asset", "inspiration"].includes(scope));
  if (invalid.length) throw new Error(`Invalid scope(s): ${invalid.join(", ")}`);
  if (!Number.isInteger(out.limit) || out.limit < 1 || out.limit > 100) throw new Error("--limit must be an integer between 1 and 100.");
  return out;
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function identityQueries(config, explicit) {
  const urls = [config.url, ...(config.collection?.members || []).map((member) => member.url)].filter(Boolean);
  const hosts = urls.flatMap((value) => {
    try {
      const parsed = new URL(value);
      return [parsed.hostname.replace(/^www\./, ""), parsed.hostname.replace(/^www\./, "").split(".")[0]];
    } catch {
      return [];
    }
  });
  const name = String(config.name || "").replace(/-clone$/, "").replace(/-/g, " ");
  return unique([...explicit, name, ...hosts]).slice(0, 6);
}

function stableId(candidate) {
  const source = [candidate.scope, candidate.provider, candidate.url, candidate.title].join("|");
  return crypto.createHash("sha1").update(source).digest("hex").slice(0, 12);
}

function normalizedTokens(values) {
  return unique(values.flatMap((value) => String(value).toLowerCase().split(/[^\p{L}\p{N}+#.]+/u)).filter((value) => value.length > 1));
}

function scoreCandidate(candidate, queries) {
  const primary = normalizedTokens(queries);
  const text = `${candidate.title || ""} ${candidate.url || ""} ${candidate.description || ""}`.toLowerCase();
  let score = Number(candidate.baseScore || 0);
  const reasons = [];
  for (const term of primary) {
    if (!text.includes(term)) continue;
    score += candidate.title?.toLowerCase().includes(term) ? 8 : 3;
    reasons.push(`匹配 ${term}`);
  }
  return { ...candidate, id: stableId(candidate), score, reasons: unique([...(candidate.reasons || []), ...reasons]) };
}

function githubCandidates(queries, limit) {
  const candidates = [];
  const errors = [];
  for (const query of queries.slice(0, 3)) {
    const result = spawnSync("gh", ["api", "--method", "GET", "search/repositories", "-f", `q=${query}`, "-f", `per_page=${Math.min(limit, 20)}`], { encoding: "utf8" });
    if (result.status !== 0) {
      errors.push(result.stderr.trim() || result.stdout.trim() || "GitHub search unavailable");
      break;
    }
    try {
      const payload = JSON.parse(result.stdout);
      for (const item of payload.items || []) {
        candidates.push({
          scope: "code",
          provider: "github",
          kind: "repository",
          title: item.full_name || item.name,
          url: item.html_url,
          description: item.description || "",
          query,
          baseScore: item.archived ? -5 : 2,
          metadata: { homepage: item.homepage || "", language: item.language || "", archived: Boolean(item.archived) },
        });
      }
    } catch (error) {
      errors.push(`Invalid GitHub response: ${error.message}`);
    }
  }
  return { candidates, errors };
}

async function npmCandidates(queries, limit) {
  const candidates = [];
  const errors = [];
  for (const query of queries.slice(0, 2)) {
    try {
      const response = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${Math.min(limit, 20)}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      for (const entry of payload.objects || []) {
        const pkg = entry.package || {};
        candidates.push({
          scope: "code",
          provider: "npm",
          kind: "package",
          title: pkg.name,
          url: pkg.links?.repository || pkg.links?.npm || `https://www.npmjs.com/package/${pkg.name}`,
          description: pkg.description || "",
          query,
          baseScore: 1,
          metadata: { version: pkg.version || "", npm: pkg.links?.npm || "" },
        });
      }
    } catch (error) {
      errors.push(`npm search failed for "${query}": ${error.message}`);
      break;
    }
  }
  return { candidates, errors };
}

function walkFiles(root, maxFiles = 500) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const queue = [root];
  while (queue.length && files.length < maxFiles) {
    const current = queue.shift();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist", ".clone"].includes(entry.name)) continue;
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(target);
      else if (entry.isFile() && /\.(?:html?|css|m?js|json)$/i.test(entry.name)) files.push(target);
    }
  }
  return files;
}

function assetCandidates(project, config) {
  const roots = unique([config.paths?.runnableMirror || "site", config.paths?.runnableCollection || "cases"])
    .map((value) => path.join(project, value));
  const results = [];
  const seen = new Set();
  const absoluteAsset = new RegExp(`https?:\\/\\/[^\\s\\"'()]+\\.(?:${ASSET_EXTENSIONS})(?:\\?[^\\s\\"'()]*)?`, "gi");
  const relativeAsset = new RegExp(`[\\w@./-]+\\.(?:${ASSET_EXTENSIONS})(?:\\?[^\\s\\"'()]*)?`, "gi");
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      let contents = "";
      try { contents = fs.readFileSync(file, "utf8"); } catch { continue; }
      for (const match of [...contents.matchAll(absoluteAsset), ...contents.matchAll(relativeAsset)]) {
        const value = match[0];
        if (!value || seen.has(value)) continue;
        seen.add(value);
        results.push({
          scope: "asset",
          provider: value.startsWith("http") ? "deployment" : "local-mirror",
          kind: "asset",
          title: path.basename(value.split("?")[0]),
          url: value,
          description: `Referenced by ${path.relative(project, file)}`,
          query: "mirror asset scan",
          baseScore: value.startsWith("http") ? 4 : 6,
          metadata: { referencedBy: path.relative(project, file) },
        });
      }
    }
  }
  return results;
}

function inspirationCandidates(queries) {
  const query = encodeURIComponent(queries[0] || "web design");
  return INSPIRATION_PROVIDERS.map(([provider, template, description], index) => ({
    scope: "inspiration",
    provider,
    kind: "search-route",
    title: provider,
    url: template.replace("{query}", query),
    description,
    query: queries[0] || "web design",
    baseScore: Math.max(1, 8 - Math.floor(index / 3)),
    reasons: ["fallback search route; external result is not a Library holding"],
  }));
}

function mergeCandidates(existing, incoming) {
  const byId = new Map((existing || []).map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, { ...(byId.get(item.id) || {}), ...item });
  return [...byId.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function printSummary(report) {
  console.log(`${report.projectName} · discovery ${report.apply ? "applied" : "dry-run"}`);
  console.log(`Queries: ${report.queries.join(" | ")}`);
  for (const scope of report.scopes) {
    const candidates = report.candidates.filter((item) => item.scope === scope);
    console.log(`\n${scope} (${candidates.length})`);
    for (const item of candidates.slice(0, report.limit)) {
      console.log(`- [${item.id}] ${item.score.toFixed(1)} · ${item.provider} · ${item.title}`);
      console.log(`  ${item.url}`);
    }
  }
  for (const error of report.errors) console.log(`warning: ${error}`);
  if (!report.apply) console.log("\nDry run only. Re-run with --apply to persist candidates.");
  console.log("Candidates remain unverified until recorded with `yah source`.");
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const project = path.resolve(args.project);
  const { config, finalized } = readProjectConfig(project);
  if (finalized) throw new Error("Discovery only runs before finalize while .clone/project.json exists.");
  const queries = identityQueries(config, args.queries);
  if (!queries.length) throw new Error("No project identity or --query was available.");
  const collected = [];
  const errors = [];
  if (args.scopes.includes("code") && !args.offline) {
    const github = githubCandidates(queries, args.limit);
    collected.push(...github.candidates);
    errors.push(...github.errors);
    const npm = await npmCandidates(queries, args.limit);
    collected.push(...npm.candidates);
    errors.push(...npm.errors);
  }
  if (args.scopes.includes("asset")) collected.push(...assetCandidates(project, config));
  if (args.scopes.includes("inspiration")) collected.push(...inspirationCandidates(queries));
  const ranked = collected.map((candidate) => scoreCandidate(candidate, queries));
  const candidates = args.scopes.flatMap((scope) => ranked.filter((item) => item.scope === scope)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, args.limit));
  const run = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    scopes: args.scopes,
    queries,
    offline: args.offline,
    candidateIds: candidates.map((item) => item.id),
    errors,
    completeness: args.offline && args.scopes.includes("code") ? "partial" : errors.length ? "partial" : "complete",
  };
  const report = { schemaVersion: 1, generator: "yah-web-clone/discover", projectName: config.name, project, apply: args.apply, limit: args.limit, scopes: args.scopes, queries, candidates, errors, run };
  if (args.apply) {
    const evidence = path.join(project, ".clone", "evidence");
    const file = path.join(evidence, "discovery.json");
    fs.mkdirSync(evidence, { recursive: true });
    const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { schemaVersion: 1, runs: [], candidates: [] };
    const persisted = {
      schemaVersion: 1,
      generator: "yah-web-clone/discover",
      updatedAt: new Date().toISOString(),
      runs: [...(previous.runs || []), run].slice(-25),
      candidates: mergeCandidates(previous.candidates, candidates),
    };
    fs.writeFileSync(file, `${JSON.stringify(persisted, null, 2)}\n`);
    const stage = config.stages?.source_discovery;
    if (stage && !["completed", "skipped"].includes(stage.status)) {
      updateProjectStage(project, "source_discovery", "in_progress", `候选发现已运行：${candidates.length} 项；待核验并用 yah source 登记`);
    }
    report.file = file;
  }
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printSummary(report);
} catch (error) {
  console.error(`discover-project failed: ${error.message}`);
  process.exit(1);
}
