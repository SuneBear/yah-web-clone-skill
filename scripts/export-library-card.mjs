#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readProjectConfig } from "./lib/project-state.mjs";
import { normalizeCatalog } from "./lib/catalog.mjs";

function usage() {
  console.log(`Usage:
  node scripts/export-library-card.mjs --project <dir> [--format sune-library] [--out <file> --apply]

Emits one Sune Library candidate card to stdout. The command never writes into
Sune Library, Raindrop, Studio, or a Library index. --out requires --apply and
only writes the explicit destination so a later Sune capture/curate step can
review and ingest it.
`);
}

function parseArgs(argv) {
  const out = { project: "", out: "", format: "sune-library", apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--format") out.format = argv[++i] || "";
    else if (arg === "--out") out.out = argv[++i] || "";
    else if (arg === "--apply") out.apply = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function git(project, args) {
  const result = spawnSync("git", args, { cwd: project, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function githubUrl(config, project) {
  const remote = git(project, ["remote", "get-url", "origin"]);
  const match = remote.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/i);
  if (match) return `https://github.com/${match[1]}`;
  const org = String(config.delivery?.githubOrg || "").trim();
  return org && config.name ? `https://github.com/${org}/${config.name}` : "";
}

function summaryFromReadme(project, config) {
  const file = path.join(project, "README.md");
  if (!fs.existsSync(file)) return `${config.mode || "web"} project created with Yah Web Clone.`;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const paragraph = [];
  for (const line of lines) {
    const value = line.trim();
    if (!value || value.startsWith("#") || value.startsWith("<!--") || value.startsWith("[") || value.startsWith("- ")) {
      if (paragraph.length) break;
      continue;
    }
    if (value.startsWith(">")) continue;
    paragraph.push(value);
  }
  return paragraph.join(" ") || `${config.mode || "web"} project created with Yah Web Clone.`;
}

function sourceProvenance(project) {
  const files = [
    path.join(project, "docs", "evidence", "source-provenance.json"),
    path.join(project, ".clone", "evidence", "source-provenance.json"),
  ];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      return {
        sources: (data.sources || []).map((item) => ({ kind: item.kind, source: item.source, relation: item.relation, evidence: item.evidence, role: item.role || undefined })),
        searches: (data.searches || []).map((item) => ({ scope: item.scope, outcome: item.outcome, note: item.note })),
      };
    } catch { /* use next location */ }
  }
  return { sources: [], searches: [] };
}

function buildCard(project, config) {
  const catalog = normalizeCatalog(config.catalog);
  const repo = githubUrl(config, project);
  const revision = git(project, ["rev-parse", "HEAD"]);
  const today = new Date().toISOString().slice(0, 10);
  const productionUrl = config.delivery?.productionUrl || config.delivery?.deploymentUrl || "";
  return {
    schema_version: "1.0",
    generator: "yah-web-clone/export-library-card",
    status: "candidate",
    id: repo ? `github:${repo.replace("https://github.com/", "")}` : `yah:${config.name}`,
    resource_type: "Past Work",
    title: config.collection?.title || config.name,
    canonical_url: repo || productionUrl || config.url || "",
    platform: repo ? "github" : "other",
    relationship: "owned",
    authors: [],
    summary: summaryFromReadme(project, config),
    tags: {
      technology: catalog.tags.technology,
      capability: catalog.tags.capability,
      visual_style: catalog.tags.visualStyle,
      use_case: catalog.facets.artifact,
    },
    facets: catalog.facets,
    keywords: catalog.keywords,
    language: null,
    dependencies: [],
    license: null,
    captured_at: today,
    last_verified_at: today,
    source_status: "active",
    provenance: {
      collection: config.delivery?.githubOrg ? String(config.delivery.githubOrg).toLowerCase() : "yah-web-clone",
      upstream_url: config.url || null,
      revision: revision || null,
      mode: config.mode,
      source_discovery: sourceProvenance(project),
    },
    project: {
      repository_url: repo || null,
      production_url: productionUrl || null,
      original_url: config.url || null,
      collection_members: (config.collection?.members || []).map((member) => ({
        slug: member.slug,
        title: member.title,
        url: member.url,
        provider: member.provider || null,
        source_page: member.sourcePage || null,
        treatment: member.treatment,
        catalog: normalizeCatalog(member.catalog),
      })),
    },
    notes: "Generated candidate only. Sune Library remains the long-term Source of Truth and decides capture, deduplication, Personal Metadata, visibility, and promotion.",
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  if (args.format !== "sune-library") throw new Error("--format currently supports only sune-library.");
  if (args.apply && !args.out) throw new Error("--apply requires an explicit --out <file>.");
  if (args.out && !args.apply) throw new Error("--out requires --apply so file writes remain explicit.");
  const project = path.resolve(args.project);
  const { config } = readProjectConfig(project);
  const card = buildCard(project, config);
  const contents = `${JSON.stringify(card, null, 2)}\n`;
  if (args.apply) {
    const out = path.resolve(args.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, contents);
    console.log(out);
  } else console.log(contents.trimEnd());
} catch (error) {
  console.error(`export-library-card failed: ${error.message}`);
  process.exit(1);
}
