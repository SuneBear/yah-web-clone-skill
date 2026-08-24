#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { projectReadmeSources, renderCollectionIndex } from "./lib/collection-projection.mjs";
import { readProjectConfig } from "./lib/project-state.mjs";

function usage() {
  console.log(`Usage:
  node scripts/sync-collection.mjs --project <dir> [--apply]

Rebuilds the managed README source block and cases/index.html from project Meta.
Dry-run by default.`);
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

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const project = path.resolve(args.project);
  const { config } = readProjectConfig(project);
  if (config.mode !== "collection") throw new Error("collection sync requires collection mode.");
  const cases = config.paths?.runnableCollection || "cases";
  const indexFile = path.join(project, cases, "index.html");
  const readmeFile = path.join(project, "README.md");
  const readme = fs.existsSync(readmeFile) ? fs.readFileSync(readmeFile, "utf8") : "";
  console.log(`${args.apply ? "Syncing" : "Would sync"}: ${indexFile}`);
  console.log(`${args.apply ? "Syncing" : "Would sync"}: ${readmeFile}`);
  if (!args.apply) {
    console.log("Dry run only. Re-run with --apply to write projections.");
    process.exit(0);
  }
  fs.mkdirSync(path.dirname(indexFile), { recursive: true });
  fs.writeFileSync(indexFile, renderCollectionIndex(config));
  fs.writeFileSync(readmeFile, projectReadmeSources(readme, config));
  console.log("Collection projections synced from project Meta.");
} catch (error) {
  console.error(`sync-collection failed: ${error.message}`);
  process.exit(1);
}
