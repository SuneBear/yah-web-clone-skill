#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.log(`Usage:
  node scripts/source-provenance.mjs --project <dir> --kind <github|sourcemap|deployment|runtime> --source <url-or-repo> --path <relative-path> [--revision <commit-or-hash>] [--evidence <SOURCE|PARTIAL>]

Appends an entry to .clone/evidence/source-provenance.json.
`);
}

function parseArgs(argv) {
  const out = { project: "", kind: "", source: "", path: "", revision: "", evidence: "SOURCE" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--kind") out.kind = argv[++i] || "";
    else if (arg === "--source") out.source = argv[++i] || "";
    else if (arg === "--path") out.path = argv[++i] || "";
    else if (arg === "--revision") out.revision = argv[++i] || "";
    else if (arg === "--evidence") out.evidence = argv[++i] || "SOURCE";
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project || !args.kind || !args.source || !args.path) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  if (!["github", "sourcemap", "deployment", "runtime"].includes(args.kind)) {
    throw new Error("Invalid --kind.");
  }
  if (!["SOURCE", "PARTIAL"].includes(args.evidence)) {
    throw new Error("Invalid --evidence.");
  }
  const project = path.resolve(args.project);
  const recon = path.join(project, ".clone", "evidence");
  const file = path.join(recon, "source-provenance.json");
  fs.mkdirSync(recon, { recursive: true });
  const data = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { schemaVersion: 1, sources: [] };
  data.sources.push({
    kind: args.kind,
    source: args.source,
    revision: args.revision,
    path: args.path,
    evidence: args.evidence,
    recordedAt: new Date().toISOString(),
  });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(file);
} catch (error) {
  console.error(`source-provenance failed: ${error.message}`);
  process.exit(1);
}
