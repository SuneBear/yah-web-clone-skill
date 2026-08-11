#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { catalogProblems, catalogTopics } from "./lib/catalog.mjs";
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

function validate(project, config) {
  const findings = [];
  const add = (severity, code, message, target = "") => findings.push({ severity, code, message, target });
  const existsDir = (relative) => fs.existsSync(path.join(project, relative)) && fs.statSync(path.join(project, relative)).isDirectory();
  const mode = config.mode || "full";
  const site = config.paths?.runnableMirror || "site";
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
  for (const problem of catalogProblems(config.catalog)) {
    add("warning", "catalog-metadata", problem, config.paths?.work ? ".clone/project.json" : "clone.config.json");
  }
  const topics = catalogTopics(config.catalog);
  if (topics.length && (!readme.includes("<!-- yah-catalog:start -->") || !topics.every((topic) => readme.includes(`\`${topic}\``)))) {
    add("warning", "catalog-readme", "Run yah catalog --apply to project catalog metadata into README.", "README.md");
  }

  if (mode !== "effect") {
    if (!existsDir(site) || !hasHtml(path.join(project, site))) {
      add("error", "missing-site", "This mode requires a runnable site containing HTML.", site);
    }
  } else if (existsDir(site)) {
    add("warning", "unexpected-site", "effect mode should not include an unrelated site mirror.", site);
  }

  if (mode === "mirror") {
    if (existsDir(lab)) add("warning", "unexpected-lab", "mirror mode should not contain a Lab.", lab);
    if (fs.existsSync(path.join(project, docs, "ANALYSIS.md"))) {
      add("warning", "unexpected-analysis", "mirror mode should not include implementation analysis.", `${docs}/ANALYSIS.md`);
    }
  } else {
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
  }

  const evidenceFiles = walk(path.join(project, evidence));
  if (!evidenceFiles.length) add("error", "missing-evidence", "Keep minimal source or verification evidence.", evidence);

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
