#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  CATALOG_LABELS,
  CATALOG_TAG_FIELDS,
  catalogProblems,
  catalogTopics,
  normalizeCatalog,
} from "./lib/catalog.mjs";
import { readProjectConfig } from "./lib/project-state.mjs";

const START = "<!-- yah-catalog:start -->";
const END = "<!-- yah-catalog:end -->";

function usage() {
  console.log(`Usage:
  node scripts/catalog-project.mjs --project <dir> [options]

Options:
  --technology <csv>      Replace technology tags
  --capability <csv>      Replace capability tags
  --visual-style <csv>    Replace visual style tags
  --subject <csv>         Replace subject tags
  --keywords <csv>        Replace Chinese/natural-language keywords
  --clear                 Clear all catalog metadata
  --github                Sync projected tags to GitHub Topics
  --repo <owner/name>      Override repository inferred from config
  --apply                 Write config/README and, with --github, GitHub Topics

Dry-run by default. Unspecified fields retain their current values.`);
}

function parseArgs(argv) {
  const out = { project: "", apply: false, github: false, repo: "", clear: false, fields: {} };
  const fieldFlags = {
    "--technology": "technology",
    "--capability": "capability",
    "--visual-style": "visualStyle",
    "--subject": "subject",
    "--keywords": "keywords",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--apply") out.apply = true;
    else if (arg === "--github") out.github = true;
    else if (arg === "--repo") out.repo = argv[++i] || "";
    else if (arg === "--clear") out.clear = true;
    else if (fieldFlags[arg]) out.fields[fieldFlags[arg]] = argv[++i] ?? "";
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function renderBlock(catalog) {
  const lines = [START, "## 分类", ""];
  for (const field of CATALOG_TAG_FIELDS) {
    const tags = catalog.tags[field];
    if (tags.length) lines.push(`- ${CATALOG_LABELS[field]}：${tags.map((tag) => `\`${tag}\``).join("、")}`);
  }
  if (catalog.keywords.length) lines.push(`- 关键词：${catalog.keywords.join("、")}`);
  lines.push(END);
  return lines.join("\n");
}

function projectReadme(readme, catalog) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  const block = catalogTopics(catalog).length ? renderBlock(catalog) : "";
  if (start >= 0 && end >= start) {
    const after = end + END.length;
    return `${readme.slice(0, start).trimEnd()}${block ? `\n\n${block}` : ""}${readme.slice(after)}`.replace(/\n{3,}/g, "\n\n");
  }
  if (!block) return readme;
  const heading = readme.search(/\n##\s/);
  if (heading >= 0) return `${readme.slice(0, heading).trimEnd()}\n\n${block}\n${readme.slice(heading)}`;
  return `${readme.trimEnd()}\n\n${block}\n`;
}

function inferredRepo(config, override) {
  if (override) return override;
  const org = String(config.delivery?.githubOrg || "").trim();
  const name = String(config.name || "").trim();
  return org && name ? `${org}/${name}` : "";
}

function syncGithub(repo, topics) {
  const result = spawnSync("gh", ["api", "--method", "PUT", `repos/${repo}/topics`, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({ names: topics }),
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "GitHub Topics 同步失败");
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const project = path.resolve(args.project);
  const { file, config } = readProjectConfig(project);
  const base = args.clear ? normalizeCatalog() : normalizeCatalog(config.catalog);
  const nextInput = { tags: { ...base.tags }, keywords: base.keywords };
  for (const field of CATALOG_TAG_FIELDS) {
    if (Object.hasOwn(args.fields, field)) nextInput.tags[field] = args.fields[field];
  }
  if (Object.hasOwn(args.fields, "keywords")) nextInput.keywords = args.fields.keywords;
  const catalog = normalizeCatalog(nextInput);
  const problems = catalogProblems(catalog);
  if (problems.length && !args.clear) throw new Error(problems.join("；"));

  const topics = catalogTopics(catalog);
  const readmeFile = path.join(project, "README.md");
  const readme = fs.existsSync(readmeFile) ? fs.readFileSync(readmeFile, "utf8") : "";
  const nextReadme = projectReadme(readme, catalog);
  const repo = args.github ? inferredRepo(config, args.repo) : "";
  if (args.github && !repo) throw new Error("无法从配置推断 GitHub 仓库，请传入 --repo <owner/name>");

  console.log(`Project: ${project}`);
  console.log(`Config: ${file}`);
  for (const field of CATALOG_TAG_FIELDS) {
    console.log(`${CATALOG_LABELS[field]}: ${catalog.tags[field].join(", ") || "-"}`);
  }
  console.log(`关键词: ${catalog.keywords.join(", ") || "-"}`);
  console.log(`GitHub Topics (${topics.length}/20): ${topics.join(", ") || "-"}`);
  if (args.github) console.log(`${args.apply ? "Sync" : "Would sync"} GitHub: ${repo}`);

  if (!args.apply) {
    console.log("Dry run only. Re-run with --apply to write config and README.");
    process.exit(0);
  }

  const nextConfig = { ...config, catalog };
  if (file.includes(`${path.sep}.clone${path.sep}`)) nextConfig.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(nextConfig, null, 2)}\n`);
  if (readme) fs.writeFileSync(readmeFile, nextReadme);
  if (args.github) syncGithub(repo, topics);
  console.log("Catalog applied to config and README.");
  if (args.github) console.log("GitHub Topics synced.");
} catch (error) {
  console.error(`catalog-project failed: ${error.message}`);
  process.exit(1);
}
