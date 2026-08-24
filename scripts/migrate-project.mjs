#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { normalizeCatalog } from "./lib/catalog.mjs";
import { PROJECT_STAGES, readProjectConfig, stagesForMode } from "./lib/project-state.mjs";

const TARGET_VERSION = "3.7";

function usage() {
  console.log(`Usage:
  node scripts/migrate-project.mjs --project <dir> [--apply]

Dry-run by default. Normalizes legacy stage names and Catalog v2 while
preserving project content, unknown fields, internal-source policy, and the
final clone.config.json rule that forbids machine-specific absolute paths.
`);
}

function parseArgs(argv) {
  const out = { project: "", apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--apply") out.apply = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function normalizeStages(config) {
  const now = new Date().toISOString();
  const legacy = config.stages || {};
  const required = stagesForMode(config.mode || "full", config.delivery?.publishTargets || []);
  const stages = {};
  for (const stage of PROJECT_STAGES) {
    const item = legacy[stage]
      || (stage === "capture" ? legacy.recon : null)
      || (stage === "effect_extract" ? legacy.study_source : null);
    stages[stage] = item || {
      status: required.includes(stage) ? "pending" : "skipped",
      updatedAt: now,
      note: required.includes(stage) ? "added by yah migrate; review required" : "not required by project mode",
    };
  }
  return { required, stages };
}

function migrate(config, finalized, projectRoot) {
  let next = {
    ...config,
    schemaVersion: finalized ? 1 : 3,
    skill: "yah-web-clone",
    skillVersion: TARGET_VERSION,
    catalog: normalizeCatalog(config.catalog),
  };
  if (next.mode === "collection" && next.collection) {
    next = {
      ...next,
      collection: {
        ...next.collection,
        members: (next.collection.members || []).map((member) => ({ ...member, catalog: normalizeCatalog(member.catalog) })),
      },
    };
  }
  if (!finalized) {
    const normalized = normalizeStages(next);
    next.requiredStages = normalized.required;
    next.stages = normalized.stages;
    next.project = path.resolve(next.project || projectRoot);
    next.updatedAt = new Date().toISOString();
  } else {
    delete next.project;
    delete next.requiredStages;
    delete next.stages;
  }
  return next;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const project = path.resolve(args.project);
  const { file, config, finalized } = readProjectConfig(project);
  const next = migrate(config, finalized, project);
  const before = JSON.stringify(config);
  const after = JSON.stringify(next);
  console.log(`${args.apply ? "Migrating" : "Would migrate"}: ${file}`);
  console.log(`Skill version: ${config.skillVersion || "legacy"} -> ${TARGET_VERSION}`);
  console.log(`Config kind: ${finalized ? "final" : "process"}`);
  console.log(`Changed: ${before === after ? "no" : "yes"}`);
  if (!args.apply) {
    console.log("Dry run only. Re-run with --apply to write the normalized config.");
    process.exit(0);
  }
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  if (finalized && serialized.includes(project)) throw new Error("Migrated final config contains an absolute project path.");
  fs.writeFileSync(file, serialized);
  console.log(file);
} catch (error) {
  console.error(`migrate-project failed: ${error.message}`);
  process.exit(1);
}
