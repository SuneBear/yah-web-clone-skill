#!/usr/bin/env node
import path from "node:path";
import {
  PROJECT_STAGES,
  readProjectState,
  updateProjectStage,
} from "./lib/project-state.mjs";

function usage() {
  console.log(`Usage:
  node scripts/pipeline.mjs status --project <dir>
  node scripts/pipeline.mjs start --project <dir> --stage <stage> [--note <text>]
  node scripts/pipeline.mjs complete --project <dir> --stage <stage> [--note <text>]
  node scripts/pipeline.mjs block --project <dir> --stage <stage> --note <reason>
  node scripts/pipeline.mjs reset --project <dir> --stage <stage>

Stages:
  ${PROJECT_STAGES.join(", ")}
`);
}

function parseArgs(argv) {
  const out = { command: "", project: "", stage: "", note: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (!out.command) out.command = arg;
    else if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--stage") out.stage = argv[++i] || "";
    else if (arg === "--note") out.note = argv[++i] || "";
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function printStatus(state) {
  console.log(`${state.name} · ${state.mode}`);
  console.log(state.project);
  for (const stage of PROJECT_STAGES) {
    const item = state.stages[stage]
      || (stage === "capture" ? state.stages.recon : null)
      || (stage === "effect_extract" ? state.stages.study_source : null)
      || { status: "skipped", note: "not present in legacy project" };
    const note = item.note ? ` — ${item.note}` : "";
    console.log(`${item.status.padEnd(11)} ${stage}${note}`);
  }
  const next = PROJECT_STAGES.find((stage) => {
    const item = state.stages[stage]
      || (stage === "capture" ? state.stages.recon : null)
      || (stage === "effect_extract" ? state.stages.study_source : null);
    return item && !["completed", "skipped"].includes(item.status);
  });
  console.log(next ? `next: ${next}` : "next: done");
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command || !args.project) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const project = path.resolve(args.project);
  if (args.command === "status") {
    printStatus(readProjectState(project));
    process.exit(0);
  }
  if (!args.stage) throw new Error("--stage is required.");
  const statusByCommand = {
    start: "in_progress",
    complete: "completed",
    block: "blocked",
    reset: "pending",
  };
  const status = statusByCommand[args.command];
  if (!status) throw new Error(`Unknown command "${args.command}".`);
  if (args.command === "block" && !args.note) throw new Error("block requires --note.");
  const state = updateProjectStage(project, args.stage, status, args.note);
  printStatus(state);
} catch (error) {
  console.error(`pipeline failed: ${error.message}`);
  process.exit(1);
}
