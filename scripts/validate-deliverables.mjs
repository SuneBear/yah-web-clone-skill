#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { projectCatalogHasContent, projectCatalogProblems } from "./lib/catalog.mjs";
import { renderCollectionIndex } from "./lib/collection-projection.mjs";
import { readProjectConfig } from "./lib/project-state.mjs";

function usage() {
  console.log(`Usage:
  node scripts/validate-deliverables.mjs --project <dir> [--strict] [--write]

Checks the selected mode's final surfaces, learning value, evidence, and root commands.
Warnings fail only with --strict. Errors always fail.`);
}

function parseArgs(argv) {
  const out = { project: "", strict: false, write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--strict") out.strict = true;
    else if (arg === "--write") out.write = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function walk(root, relative = "", files = []) {
  const current = path.join(root, relative);
  if (!fs.existsSync(current)) return files;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) walk(root, rel, files);
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function hasHtml(root) {
  return walk(root).some((file) => file.toLowerCase().endsWith(".html"));
}

function isSafeRelative(value) {
  return typeof value === "string"
    && value.trim()
    && !path.isAbsolute(value)
    && !value.split(/[\\/]/).includes("..");
}

function validateSourceProvenance(project, config, evidence, add) {
  const requiresDiscovery = (config.requiredStages || []).includes("source_discovery")
    || Number.parseFloat(config.skillVersion || "0") >= 3.5;
  if (!requiresDiscovery) return;
  const relative = path.join(evidence, "source-provenance.json");
  const file = path.join(project, relative);
  if (!fs.existsSync(file)) {
    add("error", "missing-source-provenance", "Record code discovery, including a bounded no-match result, before delivery.", relative);
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    add("error", "invalid-source-provenance", error.message, relative);
    return;
  }
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const searches = Array.isArray(data.searches) ? data.searches : [];
  const legacyProvenance = Number(data.schemaVersion || 1) < 2;
  if (!sources.length && !searches.length) {
    add("error", "empty-source-provenance", "Source provenance needs an adopted source or a documented no-match search.", relative);
  }
  const codeDiscovery = sources.some((source) => source.kind !== "asset")
    || searches.some((search) => search.scope === "code" && search.outcome === "not-found" && String(search.note || "").trim());
  if (!codeDiscovery) {
    add("error", "missing-code-discovery", "Asset or inspiration discovery does not replace the required code-source search.", relative);
  }
  const kinds = new Set(["repository", "github", "sourcemap", "deployment", "runtime", "asset"]);
  const roles = new Set(["original", "replacement", "reference", "presentation"]);
  for (const [index, source] of sources.entries()) {
    const target = `${relative}#sources[${index}]`;
    if (!kinds.has(source.kind)) add("error", "invalid-source-kind", `Unsupported source kind: ${source.kind || "<missing>"}.`, target);
    const relationValid = ["exact", "partial"].includes(source.relation) || (legacyProvenance && !source.relation);
    if (!source.source || !source.path || !relationValid || !["SOURCE", "PARTIAL"].includes(source.evidence)) {
      add("error", "incomplete-source-record", "Each source needs source, path, relation, and evidence.", target);
    }
    if (source.kind === "asset") {
      if (!roles.has(source.role)) add("error", "invalid-asset-role", "Asset provenance needs original, replacement, reference, or presentation role.", target);
      if (source.role === "replacement" && source.relation !== "partial") add("error", "invalid-replacement-relation", "Replacement assets must be partial.", target);
    }
  }
  for (const [index, search] of searches.entries()) {
    if (!["code", "asset", "inspiration"].includes(search.scope) || search.outcome !== "not-found" || !String(search.note || "").trim()) {
      add("error", "invalid-source-search", "No-match searches need scope, outcome=not-found, and a useful note.", `${relative}#searches[${index}]`);
    }
  }
}

function validate(project, config) {
  const findings = [];
  const add = (severity, code, message, target = "") => findings.push({ severity, code, message, target });
  const existsDir = (relative) => fs.existsSync(path.join(project, relative)) && fs.statSync(path.join(project, relative)).isDirectory();
  const mode = config.mode || "full";
  const site = config.paths?.runnableMirror || "site";
  const cases = config.paths?.runnableCollection || "cases";
  const lab = config.paths?.runnableLab || "lab";
  const docs = config.paths?.humanDocs || "docs";
  const evidence = config.paths?.evidence || ".clone/evidence";

  const packageFile = path.join(project, "package.json");
  let pkg = {};
  try {
    pkg = JSON.parse(readText(packageFile) || "{}");
  } catch (error) {
    add("error", "invalid-package", error.message, "package.json");
  }
  if (!pkg.scripts?.dev) add("error", "missing-dev-command", "package.json must expose npm run dev.", "package.json");
  if (!pkg.scripts?.["build:deploy"]) add("error", "missing-deploy-command", "package.json must expose npm run build:deploy.", "package.json");
  const readme = readText(path.join(project, "README.md"));
  if (!readme) add("error", "missing-readme", "README.md is required.", "README.md");
  for (const problem of projectCatalogProblems(config)) {
    add("warning", "catalog-metadata", problem, config.paths?.work ? ".clone/project.json" : "clone.config.json");
  }
  if (projectCatalogHasContent(config)
    && (!readme.includes("<!-- yah-catalog:start -->") || !readme.includes("clone.config.json"))) {
    add("warning", "catalog-readme", "Run yah catalog --apply to project a compact retrieval summary into README.", "README.md");
  }

  if (["full", "mirror"].includes(mode)) {
    if (!existsDir(site) || !hasHtml(path.join(project, site))) {
      add("error", "missing-site", "This mode requires a runnable site containing HTML.", site);
    }
  } else if (existsDir(site)) {
    add("warning", "unexpected-site", `${mode} mode should not include an unrelated site mirror.`, site);
  }

  if (mode === "mirror") {
    if (existsDir(lab)) add("warning", "unexpected-lab", "mirror mode should not contain a Lab.", lab);
    if (fs.existsSync(path.join(project, docs, "ANALYSIS.md"))) {
      add("warning", "unexpected-analysis", "mirror mode should not include implementation analysis.", `${docs}/ANALYSIS.md`);
    }
  } else if (["full", "effect"].includes(mode)) {
    if (!existsDir(lab) || !fs.existsSync(path.join(project, lab, "index.html"))) {
      add("error", "missing-lab", "full/effect mode requires a runnable Lab index.", `${lab}/index.html`);
    }
    const effectsRoot = path.join(project, lab, "effects");
    const effects = fs.existsSync(effectsRoot)
      ? fs.readdirSync(effectsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
      : [];
    if (!effects.length) add("error", "missing-effect-entry", "Create at least one lab/effects/<effect>/ entry.", `${lab}/effects`);

    let independentEffects = 0;
    const siteDependentEffects = [];
    const sourceExtensions = new Set([".css", ".frag", ".glsl", ".js", ".jsx", ".mjs", ".ts", ".tsx", ".vert", ".wgsl"]);
    for (const effect of effects) {
      const root = path.join(effectsRoot, effect.name);
      const files = walk(root);
      if (!files.includes("index.html")) {
        add("error", "missing-effect-index", "Each effect needs an index.html entry.", `${lab}/effects/${effect.name}`);
      }
      const sourceFiles = files.filter((file) => sourceExtensions.has(path.extname(file).toLowerCase()));
      if (!sourceFiles.length) {
        add("error", "missing-effect-source", "An effect needs readable source beyond its HTML shell.", `${lab}/effects/${effect.name}`);
      }
      const text = files
        .filter((file) => [".html", ...sourceExtensions].includes(path.extname(file).toLowerCase()))
        .map((file) => readText(path.join(root, file)))
        .join("\n");
      const wrapsSite = /<iframe\b/i.test(text) || /(?:src|href)\s*=\s*["'][^"']*\bsite\//i.test(text) || /\.\.\/.*\bsite\//i.test(text);
      if (wrapsSite) {
        siteDependentEffects.push(`${lab}/effects/${effect.name}`);
      } else if (sourceFiles.length) {
        independentEffects += 1;
      }
    }
    if (effects.length && independentEffects === 0) {
      add("error", "no-independent-effect", "At least one effect must run from readable Lab source without depending on site/.", `${lab}/effects`);
    }
    for (const target of siteDependentEffects) {
      add(independentEffects > 0 ? "info" : "warning", "site-dependent-effect", "This effect wraps site/; keep it as a labeled RAW REPLAY baseline alongside a projectized implementation.", target);
    }

    const analysisFile = path.join(project, docs, "ANALYSIS.md");
    const analysis = readText(analysisFile);
    if (!analysis) {
      add("error", "missing-analysis", "full/effect mode requires docs/ANALYSIS.md.", `${docs}/ANALYSIS.md`);
    } else {
      const requiredTopics = [
        ["analysis-evidence", /来源|证据|SOURCE|PARTIAL|GUESS/i, "来源与证据"],
        ["analysis-parameters", /参数|Preset/i, "参数与 Preset"],
        ["analysis-differences", /差异|缺口/i, "原版与复刻差异"],
        ["analysis-migration", /迁移|复用/i, "迁移说明"],
      ];
      for (const [code, pattern, label] of requiredTopics) {
        if (!pattern.test(analysis)) add("error", code, `ANALYSIS.md must cover ${label}.`, `${docs}/ANALYSIS.md`);
      }
      if (/待补|TODO|TBD/i.test(analysis)) add("error", "analysis-placeholder", "Remove unresolved placeholders before delivery.", `${docs}/ANALYSIS.md`);
    }
    const mediaFiles = walk(path.join(project, docs, "media")).filter((file) => /\.(?:avif|jpe?g|mp4|png|webm|webp)$/i.test(file));
    if (!mediaFiles.length) add("error", "missing-media", "Keep at least one referenced visual artifact for full/effect delivery.", `${docs}/media`);
  } else if (mode === "collection") {
    if (!existsDir(cases) || !fs.existsSync(path.join(project, cases, "index.html"))) {
      add("error", "missing-collection-index", "collection mode requires a runnable cases/index.html.", `${cases}/index.html`);
    }

    const members = Array.isArray(config.collection?.members) ? config.collection.members : [];
    if (members.length < 2) add("error", "collection-too-small", "A collection requires at least two members.", "clone.config.json#collection.members");
    const seenSlugs = new Set();
    const treatments = new Set(["reference-only", "mirror", "effect", "full"]);
    const statuses = new Set(["pending", "captured", "analyzed", "implemented", "verified", "blocked"]);
    for (const member of members) {
      const slug = String(member?.slug || "").trim();
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        add("error", "invalid-member-slug", "Each collection member needs a kebab-case slug.", "clone.config.json#collection.members");
        continue;
      }
      if (seenSlugs.has(slug)) add("error", "duplicate-member-slug", `Duplicate collection member slug: ${slug}.`, "clone.config.json#collection.members");
      seenSlugs.add(slug);
      try {
        new URL(member.url);
      } catch {
        add("error", "invalid-member-url", `Collection member ${slug} needs an absolute URL.`, "clone.config.json#collection.members");
      }
      if (member.provider && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(member.provider)) {
        add("error", "invalid-member-provider", `Collection member ${slug} provider must be kebab-case.`, "clone.config.json#collection.members");
      }
      if (member.sourcePage) {
        try {
          new URL(member.sourcePage);
        } catch {
          add("error", "invalid-member-source-page", `Collection member ${slug} sourcePage needs an absolute URL.`, "clone.config.json#collection.members");
        }
      }
      const assetTypes = new Set(["image", "video", "font", "icon", "3d-model", "texture", "audio", "other"]);
      const assetRoles = new Set(["original", "replacement", "reference", "presentation"]);
      for (const [assetIndex, asset] of (Array.isArray(member.assets) ? member.assets : []).entries()) {
        const target = `clone.config.json#collection.members.${slug}.assets[${assetIndex}]`;
        if (!String(asset.title || "").trim()) add("error", "missing-asset-title", `Collection member ${slug} asset needs a title.`, target);
        if (!assetTypes.has(asset.type)) add("error", "invalid-asset-type", `Collection member ${slug} asset has unsupported type.`, target);
        if (!assetRoles.has(asset.role)) add("error", "invalid-asset-role", `Collection member ${slug} asset has unsupported role.`, target);
        if (!asset.url && !asset.sourcePage && !asset.localPath) add("error", "missing-asset-source", `Collection member ${slug} asset needs a URL, sourcePage, or localPath.`, target);
        for (const field of ["url", "sourcePage"]) {
          if (!asset[field]) continue;
          try { new URL(asset[field]); } catch { add("error", "invalid-asset-url", `Collection member ${slug} asset ${field} needs an absolute URL.`, target); }
        }
        if (asset.localPath) {
          if (!isSafeRelative(asset.localPath)) add("error", "invalid-asset-path", `Collection member ${slug} asset localPath must be project-relative.`, target);
          else if (!fs.existsSync(path.join(project, asset.localPath))) add("error", "missing-asset-file", `Collection member ${slug} asset localPath does not exist.`, asset.localPath);
        }
        if (asset.previewUrl && !/^https?:\/\//i.test(asset.previewUrl) && !isSafeRelative(asset.previewUrl)) {
          add("error", "invalid-asset-preview", `Collection member ${slug} asset previewUrl must be absolute or project-relative.`, target);
        }
      }
      if (!treatments.has(member.treatment)) {
        add("error", "invalid-member-treatment", `Collection member ${slug} must use reference-only, mirror, effect, or full.`, "clone.config.json#collection.members");
      }
      if (!statuses.has(member.status)) {
        add("error", "invalid-member-status", `Collection member ${slug} has an unsupported status.`, "clone.config.json#collection.members");
      } else if (["pending", "captured"].includes(member.status)) {
        add("error", "unfinished-member", `Collection member ${slug} has not reached analysis or an explicit blocked state.`, "clone.config.json#collection.members");
      }
      if (member.treatment !== "reference-only" && member.status !== "blocked") {
        const hasRoute = typeof member.route === "string" && member.route.startsWith("/");
        let hasCloneRepo = false;
        try {
          hasCloneRepo = new URL(member.cloneRepo).protocol.startsWith("http");
        } catch {
          hasCloneRepo = false;
        }
        if (!hasRoute && !hasCloneRepo) {
          add("error", "missing-member-delivery", `Collection member ${slug} needs a local route or cloneRepo for treatment ${member.treatment}.`, "clone.config.json#collection.members");
        }
      }
      const caseFile = path.join(project, docs, "cases", `${slug}.md`);
      const caseText = readText(caseFile);
      if (!caseText) add("error", "missing-case-analysis", `Collection member ${slug} needs an individual analysis.`, `${docs}/cases/${slug}.md`);
      else {
        if (!/来源|证据|SOURCE|PARTIAL|GUESS/i.test(caseText)) add("error", "case-evidence", `Collection member ${slug} must discuss evidence.`, `${docs}/cases/${slug}.md`);
        if (!/集合|共性|差异|反例/i.test(caseText)) add("error", "case-relationship", `Collection member ${slug} must explain its relationship to the collection.`, `${docs}/cases/${slug}.md`);
        if (/待补|TODO|TBD/i.test(caseText)) add("error", "case-placeholder", `Remove unresolved placeholders for collection member ${slug}.`, `${docs}/cases/${slug}.md`);
      }
      if (readme && !readme.includes(slug)) add("warning", "member-readme", `README should list collection member ${slug}.`, "README.md");
    }

    const comparisonFile = path.join(project, docs, "COMPARISON.md");
    const synthesisFile = path.join(project, docs, "SYNTHESIS.md");
    const comparison = readText(comparisonFile);
    const synthesis = readText(synthesisFile);
    if (!comparison) add("error", "missing-comparison", "collection mode requires a horizontal comparison matrix.", `${docs}/COMPARISON.md`);
    else if (/待补|TODO|TBD/i.test(comparison)) add("error", "comparison-placeholder", "Remove unresolved placeholders from COMPARISON.md.", `${docs}/COMPARISON.md`);
    if (!synthesis) add("error", "missing-synthesis", "collection mode requires synthesized commonalities and differences.", `${docs}/SYNTHESIS.md`);
    else {
      for (const [pattern, label] of [[/共性/, "共性"], [/差异|反例/, "差异与反例"], [/迁移|复用/, "可迁移方法"]]) {
        if (!pattern.test(synthesis)) add("error", "synthesis-topic", `SYNTHESIS.md must cover ${label}.`, `${docs}/SYNTHESIS.md`);
      }
      if (/待补|TODO|TBD/i.test(synthesis)) add("error", "synthesis-placeholder", "Remove unresolved placeholders from SYNTHESIS.md.", `${docs}/SYNTHESIS.md`);
    }

    const mediaFiles = walk(path.join(project, docs, "media")).filter((file) => /\.(?:avif|jpe?g|mp4|png|webm|webp)$/i.test(file));
    const needsLocalMedia = members.some((member) => member.treatment !== "reference-only");
    if (needsLocalMedia && !mediaFiles.length) {
      add("error", "missing-media", "Collections with mirrored or reproduced members need a small set of referenced visual evidence.", `${docs}/media`);
    }

    if (existsDir(lab)) {
      const labFiles = walk(path.join(project, lab));
      const hasBuild = Boolean(pkg.scripts?.["build:lab"] || config.delivery?.labBuildCommand);
      if (!labFiles.includes("index.html") && !hasBuild) {
        add("error", "missing-lab-entry", "A collection Lab needs index.html or an explicit build:lab command.", lab);
      }
      if (!labFiles.some((file) => /\.(?:css|js|jsx|mjs|ts|tsx|glsl|wgsl)$/.test(file))) {
        add("error", "missing-experiment-source", "A collection Lab needs readable experiment source.", lab);
      }
    }
    const collectionIndex = readText(path.join(project, cases, "index.html"));
    if (collectionIndex && collectionIndex !== renderCollectionIndex(config)) {
      add("warning", "collection-index-stale", "Run yah collection sync --apply so cases/index.html matches project Meta.", `${cases}/index.html`);
    }
  }

  const evidenceFiles = walk(path.join(project, evidence));
  if (!evidenceFiles.length) add("error", "missing-evidence", "Keep minimal source or verification evidence.", evidence);
  validateSourceProvenance(project, config, evidence, add);

  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    mode,
    result: findings.some((finding) => finding.severity === "error")
      ? "failed"
      : findings.some((finding) => finding.severity === "warning") ? "warning" : "passed",
    findings,
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const project = path.resolve(args.project);
  const { config } = readProjectConfig(project);
  const report = validate(project, config);
  for (const finding of report.findings) {
    console.log(`${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}${finding.target ? ` (${finding.target})` : ""}`);
  }
  if (!report.findings.length) console.log(`Deliverables valid for ${report.mode} mode.`);
  if (args.write) {
    const evidence = path.resolve(project, config.paths?.evidence || ".clone/evidence");
    fs.mkdirSync(evidence, { recursive: true });
    const file = path.join(evidence, "deliverables-validation.json");
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Report: ${file}`);
  }
  const errors = report.findings.filter((finding) => finding.severity === "error").length;
  const warnings = report.findings.filter((finding) => finding.severity === "warning").length;
  if (errors || (args.strict && warnings)) process.exit(2);
} catch (error) {
  console.error(`validate-deliverables failed: ${error.message}`);
  process.exit(1);
}
