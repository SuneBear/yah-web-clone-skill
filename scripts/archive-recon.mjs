#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function usage() {
  console.log(`Usage:
  node scripts/archive-recon.mjs --project <dir> --label <name> --paths <comma-separated-relative-paths>

Copies selected previous implementation files into:
  .clone/archive/<timestamp>-<label>/snapshot/

The command never deletes source files and never creates a Git branch.
`);
}

function parseArgs(argv) {
  const out = { project: "", label: "", paths: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--label") out.label = argv[++i] || "";
    else if (arg === "--paths") out.paths = (argv[++i] || "").split(",").map((value) => value.trim()).filter(Boolean);
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function safeLabel(input) {
  return input.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "archive";
}

function validateRelative(input) {
  if (path.isAbsolute(input) || input.split(/[\\/]+/).includes("..")) {
    throw new Error(`Unsafe archive path: ${input}`);
  }
  if (input === ".git" || input.startsWith(".git/") || input === "node_modules" || input.startsWith("node_modules/")) {
    throw new Error(`Excluded archive path: ${input}`);
  }
  if (input === ".clone/archive" || input.startsWith(".clone/archive/")) {
    throw new Error("Cannot archive .clone/archive recursively.");
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project || !args.label || args.paths.length === 0) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const project = path.resolve(args.project);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archive = path.join(project, ".clone", "archive", `${timestamp}-${safeLabel(args.label)}`);
  const snapshot = path.join(archive, "snapshot");
  fs.mkdirSync(snapshot, { recursive: true });
  const copied = [];
  for (const relative of args.paths) {
    validateRelative(relative);
    const source = path.resolve(project, relative);
    if (!source.startsWith(`${project}${path.sep}`) || !fs.existsSync(source)) continue;
    const destination = path.join(snapshot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true, preserveTimestamps: true });
    copied.push(relative);
  }
  let gitCommit = "";
  try {
    gitCommit = execFileSync("git", ["-C", project, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // A Git commit is useful provenance but not required.
  }
  fs.writeFileSync(
    path.join(archive, "archive.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      label: args.label,
      archivedAt: new Date().toISOString(),
      gitCommit,
      copied,
    }, null, 2)}\n`
  );
  console.log(archive);
} catch (error) {
  console.error(`archive-project failed: ${error.message}`);
  process.exit(1);
}
