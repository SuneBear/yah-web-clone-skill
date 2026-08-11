#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scripts = path.dirname(fileURLToPath(import.meta.url));

function usage() {
  console.log(`Yah Web Clone v3

  yah.mjs init <slug> --url <url> --mode full|mirror|effect|collection [options]
  yah.mjs status --project <dir>
  yah.mjs serve --project <dir> [--surface site|lab|cases] [--port 4173]
  yah.mjs prepare-deploy --project <dir> [--lab-command <cmd>] [--lab-output <dir>]
  yah.mjs catalog --project <dir> [classification options] [--github] [--apply]
  yah.mjs validate --project <dir> [--strict] [--write]
  yah.mjs record --project <dir> --name <slug> [--format mp4|webm] [--promote]
  yah.mjs finalize --project <dir> [--apply]
  yah.mjs size --project <dir> [--limit-mb 250]
  yah.mjs clean --project <dir> [--apply]

Run a command with --help for details. GitHub creation and deployment remain explicit publish stages.
`);
}

const [command, ...args] = process.argv.slice(2);
if (!command || command === "--help" || command === "-h") {
  usage();
  process.exit(0);
}

let script = "";
let forwarded = args;
if (command === "init") script = path.join(scripts, "init-clone.mjs");
else if (command === "status") {
  script = path.join(scripts, "pipeline.mjs");
  forwarded = ["status", ...args];
}
else if (command === "size") script = path.join(scripts, "project-size.mjs");
else if (command === "clean") script = path.join(scripts, "cleanup-project.mjs");
else if (command === "catalog") script = path.join(scripts, "catalog-project.mjs");
else if (command === "validate") script = path.join(scripts, "validate-deliverables.mjs");
else if (command === "record") script = path.join(scripts, "record-motion.mjs");
else if (command === "finalize") script = path.join(scripts, "finalize-project.mjs");
else if (command === "prepare-deploy") script = path.join(scripts, "..", "assets", "project", "prepare-deploy.mjs");
else if (command === "serve") {
  const index = args.indexOf("--project");
  const project = index >= 0 ? args[index + 1] : "";
  if (!project) {
    console.error("serve requires --project <dir>");
    process.exit(1);
  }
  const root = path.resolve(project);
  const processScript = path.join(root, ".clone", "serve.mjs");
  const finalScript = path.join(root, "scripts", "serve.mjs");
  script = fs.existsSync(processScript) ? processScript : finalScript;
  forwarded = args.filter((_, i) => i !== index && i !== index + 1);
} else {
  console.error(`Unknown command: ${command}`);
  usage();
  process.exit(1);
}

const result = spawnSync(process.execPath, [script, ...forwarded], { stdio: "inherit" });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
