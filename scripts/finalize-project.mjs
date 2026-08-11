#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeCatalog } from "./lib/catalog.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeAssets = path.join(path.dirname(scriptDir), "assets", "project");

function usage() {
  console.log(`Usage:
  node scripts/finalize-project.mjs --project <dir> [--apply]

Dry-run by default. The apply phase promotes durable evidence, scripts, and
configuration, verifies the finalized layout, and only then removes .clone/.`);
}

function parseArgs(argv) {
  const out = { project: "", apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--apply") out.apply = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listFiles(root, relative = "", files = []) {
  const current = path.join(root, relative);
  if (!fs.existsSync(current)) return files;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) listFiles(root, rel, files);
    else if (entry.isFile()) files.push({ path: rel, bytes: fs.statSync(path.join(root, rel)).size });
  }
  return files;
}

function ensureRelative(input, fallback, label) {
  const value = String(input || fallback).trim();
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/).includes("..")) {
    throw new Error(`${label} must be a project-relative path: ${value}`);
  }
  return value.replace(/^\.\//, "");
}

function finalConfig(state) {
  const mode = state.mode || "full";
  return {
    schemaVersion: 1,
    skill: "yah-web-clone",
    skillVersion: state.skillVersion || "3.3",
    name: state.name || "",
    url: state.url || "",
    mode,
    effect: state.effect || "",
    authorization: state.authorization || "unknown",
    paths: {
      ...(mode !== "effect" ? {
        runnableMirror: ensureRelative(state.paths?.runnableMirror, "site", "runnableMirror"),
      } : {}),
      ...(mode !== "mirror" ? {
        runnableLab: ensureRelative(state.paths?.runnableLab, "lab", "runnableLab"),
        humanDocs: ensureRelative(state.paths?.humanDocs, "docs", "humanDocs"),
      } : {}),
      evidence: "docs/evidence",
      publishOutput: "dist",
      publishManifest: "dist.manifest.json",
    },
    contract: state.contract || {},
    catalog: normalizeCatalog(state.catalog),
    limits: state.limits || {},
    delivery: state.delivery || {},
  };
}

function workflowSummary(state) {
  return {
    schemaVersion: 1,
    finalizedAt: new Date().toISOString(),
    source: {
      name: state.name || "",
      url: state.url || "",
      mode: state.mode || "full",
      effect: state.effect || "",
      authorization: state.authorization || "unknown",
    },
    requiredStages: state.requiredStages || [],
    stages: state.stages || {},
    createdAt: state.createdAt || null,
    lastProcessUpdateAt: state.updatedAt || null,
  };
}

function updatePackage(project, mode) {
  const file = path.join(project, "package.json");
  const pkg = fs.existsSync(file) ? readJson(file) : { private: true };
  const scripts = { ...(pkg.scripts || {}) };
  scripts.dev = "node scripts/serve.mjs";
  scripts["build:deploy"] = "node scripts/prepare-deploy.mjs";
  if (mode !== "effect") scripts.site = "node scripts/serve.mjs --surface site";
  else delete scripts.site;
  if (mode !== "mirror") scripts.lab = "node scripts/serve.mjs --surface lab";
  else delete scripts.lab;
  fs.writeFileSync(file, `${JSON.stringify({ ...pkg, scripts }, null, 2)}\n`);
}

function updateGitignore(project) {
  const file = path.join(project, ".gitignore");
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  const filtered = lines.filter((line) => line && line.trim() !== ".clone/work/");
  for (const entry of ["dist/", "dist.manifest.json"]) {
    if (!filtered.includes(entry)) filtered.push(entry);
  }
  fs.writeFileSync(file, `${filtered.join("\n")}\n`);
}

function rewriteMarkdown(project) {
  const files = [path.join(project, "README.md")];
  const docs = path.join(project, "docs");
  for (const file of listFiles(docs)) {
    if (file.path.endsWith(".md")) files.push(path.join(docs, file.path));
  }
  const replacements = [
    [".clone/evidence/", "docs/evidence/"],
    [".clone/evidence", "docs/evidence"],
    [".clone/work/publish/", "dist/"],
    [".clone/work/publish", "dist"],
    [".clone/project.json", "clone.config.json"],
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let text = fs.readFileSync(file, "utf8");
    for (const [from, to] of replacements) text = text.split(from).join(to);
    fs.writeFileSync(file, text);
  }
}

function run(project, args) {
  const result = spawnSync(process.execPath, args, { cwd: project, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error([result.stderr, result.stdout].filter(Boolean).join("\n").trim() || `Command failed: node ${args.join(" ")}`);
  }
  return result.stdout.trim();
}

function validateDeliverables(project, enforce) {
  const validator = path.join(scriptDir, "validate-deliverables.mjs");
  const result = spawnSync(process.execPath, [validator, "--project", project, "--strict"], {
    cwd: project,
    encoding: "utf8",
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (output) console.log(output);
  if (enforce && result.status !== 0) {
    throw new Error("Deliverable validation failed. Resolve the reported learning, evidence, or mode-contract gaps first.");
  }
  return result.status === 0;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const project = path.resolve(args.project);
  const cloneDir = path.join(project, ".clone");
  const stateFile = path.join(cloneDir, "project.json");
  const finalFile = path.join(project, "clone.config.json");
  if (fs.existsSync(finalFile) && !fs.existsSync(stateFile)) {
    console.log("Project is already finalized; .clone/ is absent.");
    process.exit(0);
  }
  if (!fs.existsSync(stateFile)) throw new Error(`Missing process state: ${stateFile}`);

  const state = readJson(stateFile);
  const evidence = listFiles(path.join(cloneDir, "evidence"));
  const work = listFiles(path.join(cloneDir, "work"));
  const archive = listFiles(path.join(cloneDir, "archive"));
  const incomplete = (state.requiredStages || []).filter((stage) => {
    const status = state.stages?.[stage]?.status;
    return !["completed", "skipped"].includes(status);
  });

  console.log(`${args.apply ? "Finalizing" : "Would finalize"}: ${project}`);
  console.log(`Mode: ${state.mode || "full"}`);
  console.log(`Evidence to promote: ${evidence.length} files`);
  console.log(`Temporary work remaining: ${work.length} files`);
  console.log(`Archive requiring a decision: ${archive.length} files`);
  console.log("Promote .clone/evidence/ -> docs/evidence/");
  console.log("Promote runtime scripts -> scripts/");
  console.log("Create clone.config.json and docs/evidence/workflow-summary.json");
  console.log("Verify finalized runtime, then remove .clone/");

  const deliverablesReady = validateDeliverables(project, args.apply);

  if (!args.apply) {
    if (!deliverablesReady) console.log("Not ready: deliverable validation has errors or strict warnings.");
    if (incomplete.length) console.log(`Not ready: incomplete stages: ${incomplete.join(", ")}`);
    if (work.length) console.log("Not ready: clean .clone/work/ after promoting any useful artifacts.");
    if (archive.length) console.log("Not ready: explicitly promote or remove .clone/archive/ contents.");
    console.log("Dry run only. Re-run with --apply when all readiness checks pass.");
    process.exit(0);
  }

  if (incomplete.length) throw new Error(`Cannot finalize with incomplete stages: ${incomplete.join(", ")}`);
  if (work.length) throw new Error("Cannot finalize while .clone/work/ contains files. Promote useful artifacts, then run clean --apply.");
  if (archive.length) throw new Error("Cannot finalize while .clone/archive/ contains files. Promote or remove them explicitly first.");

  const config = finalConfig(state);
  const serializedConfig = `${JSON.stringify(config, null, 2)}\n`;
  if (serializedConfig.includes(project)) throw new Error("Final config unexpectedly contains the absolute project path.");

  const docsEvidence = path.join(project, "docs", "evidence");
  fs.mkdirSync(docsEvidence, { recursive: true });
  if (fs.existsSync(path.join(cloneDir, "evidence"))) {
    fs.cpSync(path.join(cloneDir, "evidence"), docsEvidence, { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(docsEvidence, "workflow-summary.json"), `${JSON.stringify(workflowSummary(state), null, 2)}\n`);
  fs.writeFileSync(finalFile, serializedConfig);

  const runtimeDir = path.join(project, "scripts");
  fs.mkdirSync(runtimeDir, { recursive: true });
  for (const name of ["serve.mjs", "prepare-deploy.mjs"]) {
    const source = path.join(runtimeAssets, name);
    if (!fs.existsSync(source)) throw new Error(`Missing runtime script: ${source}`);
    fs.copyFileSync(source, path.join(runtimeDir, name));
  }
  updatePackage(project, config.mode);
  updateGitignore(project);
  rewriteMarkdown(project);

  const backup = path.join(project, ".clone-finalize-backup");
  if (fs.existsSync(backup)) throw new Error(`Refusing to replace existing backup: ${backup}`);
  fs.renameSync(cloneDir, backup);
  try {
    run(project, [path.join(runtimeDir, "serve.mjs"), "--help"]);
    const output = run(project, [path.join(runtimeDir, "prepare-deploy.mjs")]);
    if (output) console.log(output);
  } catch (error) {
    fs.renameSync(backup, cloneDir);
    throw new Error(`Finalized layout verification failed; .clone/ was restored. ${error.message}`);
  }
  fs.rmSync(backup, { recursive: true, force: true });
  console.log("Finalized layout verified. .clone/ removed after durable artifacts were promoted.");
} catch (error) {
  console.error(`finalize-project failed: ${error.message}`);
  process.exit(1);
}
