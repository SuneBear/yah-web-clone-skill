#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { normalizeCatalog, CATALOG_TAG_FIELDS, CATALOG_FACET_FIELDS } from "./lib/catalog.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace-config.mjs";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".next", ".nuxt", ".svelte-kit", ".astro", ".cache", "coverage"]);

function usage() {
  console.log(`Usage:
  node scripts/catalog-workspace.mjs index [--root <dir>] [--out <file>] [--json]
  node scripts/catalog-workspace.mjs search <query> [--root <dir>] [filters] [--limit <n>] [--json]

Filters:
  --mode <full|mirror|effect|collection>
  --kind <project|case>
  --technology, --capability, --visual-style, --subject <csv>
  --artifact, --asset-type, --industry, --palette, --platform, --builder <csv>

The index is an on-demand, rebuildable workspace projection. It never writes to
Sune Library. --out is optional and writes a portable snapshot only.
`);
}

function parseArgs(argv) {
  const out = { command: "", query: "", root: "", out: "", json: false, limit: 20, mode: "", kind: "", filters: {} };
  const fields = {
    "--technology": "technology", "--capability": "capability", "--visual-style": "visualStyle", "--subject": "subject",
    "--artifact": "artifact", "--asset-type": "assetType", "--industry": "industry", "--palette": "palette", "--platform": "platform", "--builder": "builder",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (!out.command) out.command = arg;
    else if (out.command === "search" && !out.query && !arg.startsWith("--")) out.query = arg;
    else if (arg === "--root") out.root = argv[++i] || "";
    else if (arg === "--out") out.out = argv[++i] || "";
    else if (arg === "--json") out.json = true;
    else if (arg === "--limit") out.limit = Number(argv[++i]);
    else if (arg === "--mode") out.mode = argv[++i] || "";
    else if (arg === "--kind") out.kind = argv[++i] || "";
    else if (fields[arg]) out.filters[fields[arg]] = String(argv[++i] || "").split(",").map(normalizeValue).filter(Boolean);
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if (!Number.isInteger(out.limit) || out.limit < 1 || out.limit > 500) throw new Error("--limit must be an integer between 1 and 500.");
  if (out.kind && !["project", "case"].includes(out.kind)) throw new Error("--kind must be project or case.");
  return out;
}

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase().replace(/[^\p{L}\p{N}+#.]+/gu, "-").replace(/^-+|-+$/g, "");
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function findProjects(root) {
  const configs = [];
  const queue = [root];
  while (queue.length) {
    const current = queue.shift();
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    const final = entries.find((entry) => entry.isFile() && entry.name === "clone.config.json");
    const processFile = path.join(current, ".clone", "project.json");
    if (final) {
      configs.push(path.join(current, final.name));
      continue;
    }
    if (fs.existsSync(processFile)) {
      configs.push(processFile);
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name === ".clone") continue;
      queue.push(path.join(current, entry.name));
    }
  }
  return configs;
}

function repositoryUrl(config) {
  const org = String(config.delivery?.githubOrg || "").trim();
  return org && config.name ? `https://github.com/${org}/${config.name}` : "";
}

function flattenCatalog(catalog) {
  const normalized = normalizeCatalog(catalog);
  return [
    ...CATALOG_TAG_FIELDS.flatMap((field) => normalized.tags[field]),
    ...CATALOG_FACET_FIELDS.flatMap((field) => normalized.facets[field]),
    ...normalized.keywords,
  ];
}

function recordsFromConfig(file, config) {
  const projectRoot = file.includes(`${path.sep}.clone${path.sep}`) ? path.dirname(path.dirname(file)) : path.dirname(file);
  const project = {
    id: `yah:${config.name || path.basename(projectRoot)}`,
    kind: "project",
    name: config.name || path.basename(projectRoot),
    title: config.collection?.title || config.name || path.basename(projectRoot),
    mode: config.mode || "",
    projectRoot,
    configFile: file,
    url: config.url || "",
    repositoryUrl: repositoryUrl(config),
    catalog: normalizeCatalog(config.catalog),
    keywords: flattenCatalog(config.catalog),
  };
  const records = [project];
  if (config.mode === "collection") {
    for (const member of config.collection?.members || []) {
      records.push({
        id: `yah:${project.name}:case:${member.slug}`,
        kind: "case",
        name: member.slug,
        title: member.title || member.slug,
        mode: member.treatment || "reference-only",
        projectName: project.name,
        projectRoot,
        configFile: file,
        url: member.url || "",
        sourcePage: member.sourcePage || "",
        provider: member.provider || "",
        assets: member.assets || [],
        catalog: normalizeCatalog(member.catalog),
        keywords: flattenCatalog(member.catalog),
      });
    }
  }
  return records;
}

function buildIndex(root) {
  const errors = [];
  const records = [];
  for (const file of findProjects(root)) {
    const config = readJson(file);
    if (!config) {
      errors.push({ file, error: "invalid-json" });
      continue;
    }
    records.push(...recordsFromConfig(file, config));
  }
  return {
    schemaVersion: 1,
    generator: "yah-web-clone/catalog-workspace",
    generatedAt: new Date().toISOString(),
    root,
    completeness: errors.length ? "partial" : "complete",
    projectCount: records.filter((item) => item.kind === "project").length,
    recordCount: records.length,
    errors,
    records,
  };
}

function fieldValues(record, field) {
  if (CATALOG_TAG_FIELDS.includes(field)) return record.catalog.tags[field];
  if (CATALOG_FACET_FIELDS.includes(field)) return record.catalog.facets[field];
  return [];
}

function matchesFilters(record, args) {
  if (args.kind && record.kind !== args.kind) return false;
  if (args.mode && record.mode !== args.mode) return false;
  return Object.entries(args.filters).every(([field, wanted]) => wanted.every((value) => fieldValues(record, field).includes(value)));
}

function scoreRecord(record, query) {
  const terms = String(query || "").toLowerCase().split(/[^\p{L}\p{N}+#.]+/u).filter(Boolean);
  if (!terms.length) return { score: 1, reasons: ["facet/filter match"] };
  const fields = {
    title: `${record.title} ${record.name}`.toLowerCase(),
    catalog: record.keywords.join(" ").toLowerCase(),
    source: `${record.url} ${record.repositoryUrl || ""} ${record.provider || ""}`.toLowerCase(),
  };
  let score = 0;
  const reasons = [];
  for (const term of terms) {
    for (const [field, text] of Object.entries(fields)) {
      if (!text.includes(term)) continue;
      score += { title: 8, catalog: 5, source: 2 }[field];
      reasons.push(`${term} in ${field}`);
    }
  }
  return { score, reasons: [...new Set(reasons)] };
}

function printResults(payload) {
  console.log(`# Yah workspace search: ${payload.query || "facets only"}\n`);
  console.log(`Root: ${payload.root} · Results: ${payload.resultCount}\n`);
  for (const [index, item] of payload.results.entries()) {
    console.log(`${index + 1}. ${item.title} · ${item.kind}/${item.mode} · score ${item.score}`);
    console.log(`   ${item.repositoryUrl || item.url || item.projectRoot}`);
    if (item.reasons.length) console.log(`   ${item.reasons.slice(0, 5).join(", ")}`);
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !["index", "search"].includes(args.command)) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const root = resolveWorkspaceRoot({ override: args.root });
  const index = buildIndex(root);
  if (args.command === "index") {
    if (args.out) {
      const out = path.resolve(args.out);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, `${JSON.stringify(index, null, 2)}\n`);
      console.log(out);
    } else if (args.json) console.log(JSON.stringify(index, null, 2));
    else console.log(`Indexed ${index.projectCount} projects / ${index.recordCount} records under ${root}. No persistent database was created.`);
    process.exit(0);
  }
  const results = index.records
    .filter((record) => matchesFilters(record, args))
    .map((record) => ({ ...scoreRecord(record, args.query), ...record }))
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, args.limit);
  const payload = { schemaVersion: 1, query: args.query, root, resultCount: results.length, results, indexCompleteness: index.completeness, errors: index.errors };
  if (args.json) console.log(JSON.stringify(payload, null, 2));
  else printResults(payload);
} catch (error) {
  console.error(`catalog-workspace failed: ${error.message}`);
  process.exit(1);
}
