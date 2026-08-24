#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { readProjectState, updateProjectStage } from "./lib/project-state.mjs";

function usage() {
  console.log(`Usage:
  node scripts/source-provenance.mjs --project <dir> --kind <repository|github|sourcemap|deployment|runtime|asset> --source <url-or-repo> --path <relative-path> --relation <exact|partial> --evidence <SOURCE|PARTIAL> [options]
  node scripts/source-provenance.mjs --project <dir> --no-match --scope <code|asset|inspiration> --note <searched-and-fallback-summary> [--complete]

Options:
  --revision <commit-or-version>  Optional reproducibility metadata
  --checksum <algorithm:digest>   Optional asset integrity metadata
  --license <spdx-or-rights>      Optional; internal sources may omit it
  --role <original|replacement|reference|presentation>
                                  Required for asset sources; replacement must be partial
  --complete                      Mark source_discovery completed after recording this result
  --note <text>                   Stage completion note or no-match summary

Appends an entry to .clone/evidence/source-provenance.json.
`);
}

function parseArgs(argv) {
  const out = {
    project: "",
    kind: "",
    source: "",
    path: "",
    revision: "",
    checksum: "",
    license: "",
    relation: "",
    evidence: "",
    role: "",
    scope: "code",
    note: "",
    noMatch: false,
    complete: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--kind") out.kind = argv[++i] || "";
    else if (arg === "--source") out.source = argv[++i] || "";
    else if (arg === "--path") out.path = argv[++i] || "";
    else if (arg === "--revision") out.revision = argv[++i] || "";
    else if (arg === "--checksum") out.checksum = argv[++i] || "";
    else if (arg === "--license") out.license = argv[++i] || "";
    else if (arg === "--relation") out.relation = argv[++i] || "";
    else if (arg === "--evidence") out.evidence = argv[++i] || "";
    else if (arg === "--role") out.role = argv[++i] || "";
    else if (arg === "--scope") out.scope = argv[++i] || "";
    else if (arg === "--note") out.note = argv[++i] || "";
    else if (arg === "--no-match") out.noMatch = true;
    else if (arg === "--complete") out.complete = true;
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
  readProjectState(project);
  if (args.noMatch) {
    if (args.kind || args.source || args.path || args.relation || args.evidence) {
      throw new Error("--no-match cannot be combined with source record fields.");
    }
    if (!["code", "asset", "inspiration"].includes(args.scope)) throw new Error("Invalid --scope.");
    if (!args.note.trim()) throw new Error("--no-match requires --note.");
  } else {
    if (!args.kind || !args.source || !args.path || !args.relation || !args.evidence) {
      throw new Error("A source record requires --kind, --source, --path, --relation, and --evidence.");
    }
    if (!["repository", "github", "sourcemap", "deployment", "runtime", "asset"].includes(args.kind)) {
      throw new Error("Invalid --kind.");
    }
    if (!["exact", "partial"].includes(args.relation)) throw new Error("Invalid --relation.");
    if (!["SOURCE", "PARTIAL"].includes(args.evidence)) throw new Error("Invalid --evidence.");
    if (args.kind === "asset") {
      if (!["original", "replacement", "reference", "presentation"].includes(args.role)) {
        throw new Error("Asset sources require --role original|replacement|reference|presentation.");
      }
      if (args.role === "replacement" && args.relation !== "partial") {
        throw new Error("Replacement assets must use --relation partial.");
      }
    } else if (args.role) {
      throw new Error("--role is only valid for asset sources.");
    }
  }
  const recon = path.join(project, ".clone", "evidence");
  const file = path.join(recon, "source-provenance.json");
  fs.mkdirSync(recon, { recursive: true });
  const data = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { schemaVersion: 3, sources: [], searches: [] };
  data.schemaVersion = 3;
  data.sources = Array.isArray(data.sources) ? data.sources : [];
  data.searches = Array.isArray(data.searches) ? data.searches : [];
  const recordedAt = new Date().toISOString();
  if (args.noMatch) {
    data.searches.push({ scope: args.scope, outcome: "not-found", note: args.note.trim(), recordedAt });
  } else {
    data.sources.push({
      kind: args.kind,
      source: args.source,
      revision: args.revision,
      checksum: args.checksum,
      license: args.license,
      relation: args.relation,
      ...(args.kind === "asset" ? { role: args.role } : {}),
      path: args.path,
      evidence: args.evidence,
      recordedAt,
    });
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  if (args.complete) {
    const note = args.note.trim() || (args.noMatch
      ? `${args.scope} discovery completed without a verified source`
      : `${args.relation} ${args.kind} recorded: ${args.source}`);
    updateProjectStage(project, "source_discovery", "completed", note);
  }
  console.log(file);
  if (args.complete) console.log("source_discovery: completed");
} catch (error) {
  console.error(`source-provenance failed: ${error.message}`);
  process.exit(1);
}
