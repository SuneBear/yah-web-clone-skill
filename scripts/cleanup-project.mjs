#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { readProjectConfig } from "./lib/project-state.mjs";

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

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project) {
    console.log("node scripts/cleanup-project.mjs --project <dir> [--apply]");
    console.log("Dry-run by default. Removes process work files or the finalized deploy output.");
    process.exit(args.help ? 0 : 1);
  }
  const project = path.resolve(args.project);
  const { config, finalized } = readProjectConfig(project);
  const relativeTarget = finalized ? (config.paths?.publishOutput || "dist") : (config.paths?.work || ".clone/work");
  const target = path.resolve(project, relativeTarget);
  const expected = finalized
    ? path.resolve(project, config.paths?.publishOutput || "dist")
    : path.resolve(project, ".clone", "work");
  if (target !== expected || target === project) throw new Error("Refusing unexpected cleanup target.");
  const files = listFiles(target);
  const manifest = finalized
    ? path.resolve(project, config.paths?.publishManifest || "dist.manifest.json")
    : "";
  if (manifest && path.dirname(manifest) !== project) throw new Error("Refusing unexpected manifest cleanup target.");
  const manifestBytes = manifest && fs.existsSync(manifest) ? fs.statSync(manifest).size : 0;
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0) + manifestBytes;
  const fileCount = files.length + (manifestBytes ? 1 : 0);
  console.log(`${args.apply ? "Removing" : "Would remove"}: ${fileCount} files, ${(bytes / 1024 ** 2).toFixed(1)} MB`);
  console.log(target);
  if (args.apply && (fs.existsSync(target) || (manifest && fs.existsSync(manifest)))) {
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    if (manifest && fs.existsSync(manifest)) fs.rmSync(manifest, { force: true });
    console.log(finalized
      ? "Generated deploy files removed. Source, evidence, and docs were preserved."
      : "Temporary work files removed. Curated evidence and docs were preserved.");
  } else if (!args.apply) {
    console.log("Dry run only. Re-run with --apply after checking the target.");
  }
} catch (error) {
  console.error(`cleanup-project failed: ${error.message}`);
  process.exit(1);
}
