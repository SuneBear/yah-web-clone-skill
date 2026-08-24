#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PROJECT_STAGES, readProjectState, updateProjectStage } from "./lib/project-state.mjs";

function usage() {
  console.log(`Usage:
  node scripts/run-pipeline.mjs --project <dir> [options]

Options:
  --apply                 Execute safe built-ins and declared npm hooks
  --until <stage>         Stop after this stage completes or reaches a review gate
  --max-stages <n>        Maximum stages handled in this invocation (default: 10)
  --offline               Run source discovery without GitHub/npm adapters
  --json                  Emit a machine-readable plan/result

Projects may declare an executable hook as npm script yah:<stage>. Hooks are
invoked as argv through npm, never as arbitrary shell text from Yah metadata.
Without --apply, the command only previews the resumable plan.
`);
}

function parseArgs(argv) {
  const out = { project: "", apply: false, until: "", maxStages: 10, offline: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--apply") out.apply = true;
    else if (arg === "--until") out.until = argv[++i] || "";
    else if (arg === "--max-stages") out.maxStages = Number(argv[++i]);
    else if (arg === "--offline") out.offline = true;
    else if (arg === "--json") out.json = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if (out.until && !PROJECT_STAGES.includes(out.until)) throw new Error(`Unknown --until stage: ${out.until}`);
  if (!Number.isInteger(out.maxStages) || out.maxStages < 1 || out.maxStages > PROJECT_STAGES.length) {
    throw new Error(`--max-stages must be between 1 and ${PROJECT_STAGES.length}.`);
  }
  return out;
}

function stateItem(state, stage) {
  return state.stages?.[stage]
    || (stage === "capture" ? state.stages?.recon : null)
    || (stage === "effect_extract" ? state.stages?.study_source : null)
    || { status: "skipped", note: "not present in legacy project" };
}

function packageHooks(project) {
  const file = path.join(project, "package.json");
  try { return JSON.parse(fs.readFileSync(file, "utf8")).scripts || {}; } catch { return {}; }
}

function hasCodeDecision(project) {
  const file = path.join(project, ".clone", "evidence", "source-provenance.json");
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const codeSource = (data.sources || []).some((item) => item.kind !== "asset");
    const noMatch = (data.searches || []).some((item) => item.scope === "code" && item.outcome === "not-found");
    return codeSource || noMatch;
  } catch {
    return false;
  }
}

function planFor(project, state) {
  const hooks = packageHooks(project);
  return (state.requiredStages || PROJECT_STAGES)
    .filter((stage) => !["completed", "skipped"].includes(stateItem(state, stage).status))
    .map((stage) => ({
      stage,
      status: stateItem(state, stage).status,
      handler: stage === "source_discovery" ? "builtin:discover" : hooks[`yah:${stage}`] ? `npm:yah:${stage}` : "review-gate",
      note: stateItem(state, stage).note || "",
    }));
}

function readRunLog(project) {
  const file = path.join(project, ".clone", "evidence", "automation-runs.json");
  try { return { file, data: JSON.parse(fs.readFileSync(file, "utf8")) }; }
  catch { return { file, data: { schemaVersion: 1, runs: [] } }; }
}

function appendRun(project, run) {
  const { file, data } = readRunLog(project);
  data.schemaVersion = 1;
  data.runs = [...(data.runs || []), run].slice(-50);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

function executeDiscovery(project, offline) {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "discover-project.mjs");
  const args = [script, "--project", project, "--apply"];
  if (offline) args.push("--offline");
  return spawnSync(process.execPath, args, { cwd: project, encoding: "utf8" });
}

function executeHook(project, stage) {
  return spawnSync("npm", ["run", `yah:${stage}`], { cwd: project, encoding: "utf8" });
}

function printPlan(project, plan) {
  console.log(`${project}\n`);
  if (!plan.length) {
    console.log("done: all required stages are completed or skipped");
    return;
  }
  for (const item of plan) console.log(`${item.status.padEnd(11)} ${item.stage.padEnd(20)} ${item.handler}`);
  console.log("\nDry run only. Re-run with --apply to execute safe handlers.");
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const project = path.resolve(args.project);
  let state = readProjectState(project);
  const initialPlan = planFor(project, state);
  if (!args.apply) {
    const payload = { schemaVersion: 1, project, dryRun: true, plan: initialPlan };
    if (args.json) console.log(JSON.stringify(payload, null, 2));
    else printPlan(project, initialPlan);
    process.exit(0);
  }

  const run = { id: crypto.randomUUID(), startedAt: new Date().toISOString(), status: "running", events: [] };
  let handled = 0;
  let stopReason = "done";
  for (const item of initialPlan) {
    if (handled >= args.maxStages) { stopReason = "max-stages"; break; }
    handled += 1;
    if (item.stage === "source_discovery") {
      if (hasCodeDecision(project)) {
        updateProjectStage(project, item.stage, "completed", "已存在核验后的源码来源或有边界的 code no-match 结论");
        run.events.push({ stage: item.stage, outcome: "completed", handler: "provenance-check" });
      } else {
        const discoveryFile = path.join(project, ".clone", "evidence", "discovery.json");
        if (!fs.existsSync(discoveryFile)) {
          const result = executeDiscovery(project, args.offline);
          run.events.push({ stage: item.stage, outcome: result.status === 0 ? "review-required" : "failed", handler: "builtin:discover", stdout: result.stdout.trim(), stderr: result.stderr.trim() });
          if (result.status !== 0) {
            updateProjectStage(project, item.stage, "blocked", result.stderr.trim() || "自动发现失败");
            run.status = "failed";
            stopReason = "handler-failed";
            break;
          }
        } else run.events.push({ stage: item.stage, outcome: "review-required", handler: "existing-discovery" });
        updateProjectStage(project, item.stage, "in_progress", "候选已生成；核验后用 yah source 登记采用来源或 code no-match");
        stopReason = "review-required";
        break;
      }
    } else if (item.handler.startsWith("npm:")) {
      updateProjectStage(project, item.stage, "in_progress", `运行 ${item.handler}`);
      const result = executeHook(project, item.stage);
      run.events.push({ stage: item.stage, outcome: result.status === 0 ? "completed" : "failed", handler: item.handler, stdout: result.stdout.trim(), stderr: result.stderr.trim() });
      if (result.status !== 0) {
        updateProjectStage(project, item.stage, "blocked", result.stderr.trim() || `${item.handler} failed`);
        run.status = "failed";
        stopReason = "handler-failed";
        break;
      }
      updateProjectStage(project, item.stage, "completed", `${item.handler} completed`);
    } else {
      if (item.status === "pending") updateProjectStage(project, item.stage, "in_progress", "需要 Agent/人工完成并验收；可添加 npm script yah:<stage> 自动化确定性步骤");
      run.events.push({ stage: item.stage, outcome: "manual-required", handler: "review-gate" });
      stopReason = "manual-required";
      break;
    }
    if (args.until === item.stage) { stopReason = "until"; break; }
    state = readProjectState(project);
  }
  run.status = run.status === "failed" ? "failed" : stopReason === "done" ? "completed" : "paused";
  run.stopReason = stopReason;
  run.finishedAt = new Date().toISOString();
  const logFile = appendRun(project, run);
  const payload = { schemaVersion: 1, project, run, logFile, remaining: planFor(project, readProjectState(project)) };
  if (args.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(`${run.status}: ${stopReason}`);
    for (const event of run.events) console.log(`- ${event.stage}: ${event.outcome} (${event.handler})`);
    console.log(`Run log: ${logFile}`);
  }
  process.exit(run.status === "failed" ? 2 : 0);
} catch (error) {
  console.error(`run-pipeline failed: ${error.message}`);
  process.exit(1);
}
