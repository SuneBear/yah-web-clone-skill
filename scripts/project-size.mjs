#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { readProjectConfig } from "./lib/project-state.mjs";

function parseArgs(argv) {
  const out = { project: "", limitMB: 0, top: 12 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--limit-mb") out.limitMB = Number(argv[++i] || 0);
    else if (arg === "--top") out.top = Number(argv[++i] || 12);
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function walk(root, relative = "", files = []) {
  const current = path.join(root, relative);
  if (!fs.existsSync(current)) return files;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules"].includes(entry.name)) continue;
      walk(root, rel, files);
    } else if (entry.isFile()) {
      files.push({ path: rel, bytes: fs.statSync(path.join(root, rel)).size });
    }
  }
  return files;
}

function format(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project) {
    console.log("node scripts/project-size.mjs --project <dir> [--limit-mb 250] [--top 12]");
    process.exit(args.help ? 0 : 1);
  }
  const project = path.resolve(args.project);
  const { config: state } = readProjectConfig(project);
  const limitMB = args.limitMB > 0 ? args.limitMB : Number(state.limits?.maxProjectSizeMB || 250);
  const singleFileLimitMB = Number(state.limits?.maxSingleFileMB || 25);
  const files = walk(project);
  const buckets = new Map();
  for (const file of files) {
    const bucket = file.path.split(path.sep)[0];
    buckets.set(bucket, (buckets.get(bucket) || 0) + file.bytes);
  }
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  console.log(`Total: ${format(total)} (${files.length} files)`);
  for (const [bucket, bytes] of [...buckets.entries()].sort((a, b) => b[1] - a[1])) {
    const suffix = files.some((file) => file.path.startsWith(`${bucket}${path.sep}`)) ? "/" : "";
    console.log(`${format(bytes).padStart(10)}  ${bucket}${suffix}`);
  }
  console.log("\nLargest files:");
  for (const file of files.sort((a, b) => b.bytes - a.bytes).slice(0, args.top)) {
    console.log(`${format(file.bytes).padStart(10)}  ${file.path}`);
  }
  const oversized = singleFileLimitMB > 0
    ? files.filter((file) => file.bytes > singleFileLimitMB * 1024 ** 2)
    : [];
  if (oversized.length) {
    console.error(`\n${oversized.length} file(s) exceed the ${singleFileLimitMB} MB single-file budget.`);
    process.exitCode = 2;
  }
  if (limitMB > 0 && total > limitMB * 1024 ** 2) {
    console.error(`\nSize budget exceeded: ${format(total)} > ${limitMB} MB`);
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`project-size failed: ${error.message}`);
  process.exit(1);
}
