#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  CATALOG_FACET_FIELDS,
  CATALOG_LABELS,
  CATALOG_TAG_FIELDS,
  catalogHasContent,
  catalogProblems,
  catalogTopics,
  normalizeCatalog,
  normalizeTopic,
  projectCatalogHasContent,
  projectCatalogProblems,
  projectCatalogTopics,
} from "./lib/catalog.mjs";
import { readProjectConfig } from "./lib/project-state.mjs";
import { projectReadmeSources, renderCollectionIndex } from "./lib/collection-projection.mjs";

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
  --artifact <csv>        Replace retrieval facets such as landing-page, hero, app-flow
  --asset-type <csv>      Replace asset facets such as font, texture, 3d-model, audio
  --industry <csv>        Replace industry facets
  --palette <csv>         Replace palette facets such as dark, monochrome, blue
  --platform <csv>        Replace platform facets such as web, ios, mobile-web
  --builder <csv>         Replace builder facets such as framer, webflow, custom
  --keywords <csv>        Replace Chinese/natural-language keywords
  --github-topics <csv>   Curate the <=20 repo-level Topics from project/member core tags
  --case <slug>           Update one collection member instead of project-level catalog
  --clear                 Clear all catalog metadata
  --github                Sync projected tags to GitHub Topics
  --repo <owner/name>      Override repository inferred from config
  --apply                 Write config/README and, with --github, GitHub Topics

Dry-run by default. Unspecified fields retain their current values.`);
}

function parseArgs(argv) {
  const out = { project: "", apply: false, github: false, repo: "", caseSlug: "", clear: false, fields: {} };
  const fieldFlags = {
    "--technology": "technology",
    "--capability": "capability",
    "--visual-style": "visualStyle",
    "--subject": "subject",
    "--keywords": "keywords",
    "--artifact": "artifact",
    "--asset-type": "assetType",
    "--industry": "industry",
    "--palette": "palette",
    "--platform": "platform",
    "--builder": "builder",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--apply") out.apply = true;
    else if (arg === "--github") out.github = true;
    else if (arg === "--repo") out.repo = argv[++i] || "";
    else if (arg === "--case") out.caseSlug = argv[++i] || "";
    else if (arg === "--clear") out.clear = true;
    else if (arg === "--github-topics") out.githubTopics = argv[++i] ?? "";
    else if (fieldFlags[arg]) out.fields[fieldFlags[arg]] = argv[++i] ?? "";
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function renderCatalogLines(catalog) {
  const lines = [];
  for (const field of CATALOG_TAG_FIELDS) {
    const tags = catalog.tags[field];
    if (tags.length) lines.push(`- ${CATALOG_LABELS[field]}：${tags.map((tag) => `\`${tag}\``).join("、")}`);
  }
  for (const field of CATALOG_FACET_FIELDS) {
    const values = catalog.facets[field];
    if (values.length) lines.push(`- ${CATALOG_LABELS[field]}：${values.map((value) => `\`${value}\``).join("、")}`);
  }
  if (catalog.keywords.length) lines.push(`- 关键词：${catalog.keywords.join("、")}`);
  return lines;
}

function renderBlock(config) {
  const catalog = normalizeCatalog(config.catalog);
  const lines = [START, "## 分类", ""];
  lines.push(...renderCatalogLines(catalog));
  if (config.mode === "collection") {
    const tagged = (config.collection?.members || [])
      .map((member) => ({ ...member, catalog: normalizeCatalog(member.catalog) }))
      .filter((member) => catalogHasContent(member.catalog));
    if (tagged.length) {
      lines.push("", "### 案例分类", "");
      for (const member of tagged) {
        const topics = catalogTopics(member.catalog).map((topic) => `\`${topic}\``).join("、");
        const facets = CATALOG_FACET_FIELDS
          .flatMap((field) => member.catalog.facets[field])
          .map((value) => `\`${value}\``)
          .join("、");
        const details = [topics, facets, ...member.catalog.keywords].filter(Boolean).join("；");
        lines.push(`- \`${member.slug}\`：${details}`);
      }
    }
  }
  lines.push(END);
  return lines.join("\n");
}

function projectReadme(readme, config) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  const block = projectCatalogHasContent(config) ? renderBlock(config) : "";
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
  let memberIndex = -1;
  if (args.caseSlug) {
    if (config.mode !== "collection") throw new Error("--case is only valid for collection mode");
    memberIndex = (config.collection?.members || []).findIndex((member) => member.slug === args.caseSlug);
    if (memberIndex < 0) throw new Error(`Unknown collection member: ${args.caseSlug}`);
  }
  if (args.caseSlug && args.githubTopics !== undefined) {
    throw new Error("--github-topics is project-level and cannot be combined with --case");
  }
  const currentCatalog = memberIndex >= 0 ? config.collection.members[memberIndex].catalog : config.catalog;
  const base = args.clear ? normalizeCatalog() : normalizeCatalog(currentCatalog);
  const nextInput = { tags: { ...base.tags }, facets: { ...base.facets }, keywords: base.keywords };
  for (const field of CATALOG_TAG_FIELDS) {
    if (Object.hasOwn(args.fields, field)) nextInput.tags[field] = args.fields[field];
  }
  for (const field of CATALOG_FACET_FIELDS) {
    if (Object.hasOwn(args.fields, field)) nextInput.facets[field] = args.fields[field];
  }
  if (Object.hasOwn(args.fields, "keywords")) nextInput.keywords = args.fields.keywords;
  const catalog = normalizeCatalog(nextInput);
  const problems = catalogProblems(catalog);
  if (problems.length && !args.clear) throw new Error(problems.join("；"));

  let nextConfig = memberIndex >= 0
    ? {
      ...config,
      collection: {
        ...config.collection,
        members: config.collection.members.map((member, index) => index === memberIndex ? { ...member, catalog } : member),
      },
    }
    : { ...config, catalog };
  if (args.githubTopics !== undefined) {
    const githubTopics = [...new Set(String(args.githubTopics).split(",").map(normalizeTopic).filter(Boolean))];
    nextConfig = {
      ...nextConfig,
      delivery: { ...(nextConfig.delivery || {}), githubTopics },
    };
  } else if (args.clear && memberIndex < 0) {
    nextConfig = {
      ...nextConfig,
      delivery: { ...(nextConfig.delivery || {}), githubTopics: [] },
    };
  }
  const projectionProblems = projectCatalogProblems(nextConfig).filter((problem) => problem.startsWith("精选 GitHub Topics"));
  if (projectionProblems.length && !args.clear) throw new Error(projectionProblems.join("；"));
  const topics = projectCatalogTopics(nextConfig);
  if (topics.length > 20) throw new Error(`项目与案例汇总后的 GitHub Topics 最多 20 个，当前为 ${topics.length} 个`);
  const readmeFile = path.join(project, "README.md");
  const readme = fs.existsSync(readmeFile) ? fs.readFileSync(readmeFile, "utf8") : "";
  const nextReadme = projectReadme(projectReadmeSources(readme, nextConfig), nextConfig);
  const repo = args.github ? inferredRepo(config, args.repo) : "";
  if (args.github && !repo) throw new Error("无法从配置推断 GitHub 仓库，请传入 --repo <owner/name>");

  console.log(`Project: ${project}`);
  console.log(`Config: ${file}`);
  console.log(`Target: ${memberIndex >= 0 ? `case:${args.caseSlug}` : "project"}`);
  for (const field of CATALOG_TAG_FIELDS) {
    console.log(`${CATALOG_LABELS[field]}: ${catalog.tags[field].join(", ") || "-"}`);
  }
  for (const field of CATALOG_FACET_FIELDS) {
    console.log(`${CATALOG_LABELS[field]}: ${catalog.facets[field].join(", ") || "-"}`);
  }
  console.log(`关键词: ${catalog.keywords.join(", ") || "-"}`);
  console.log(`GitHub Topics (${topics.length}/20): ${topics.join(", ") || "-"}`);
  if (args.github) console.log(`${args.apply ? "Sync" : "Would sync"} GitHub: ${repo}`);

  if (!args.apply) {
    console.log("Dry run only. Re-run with --apply to write config and README.");
    process.exit(0);
  }

  if (file.includes(`${path.sep}.clone${path.sep}`)) nextConfig.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(nextConfig, null, 2)}\n`);
  if (readme) fs.writeFileSync(readmeFile, nextReadme);
  if (nextConfig.mode === "collection") {
    const cases = nextConfig.paths?.runnableCollection || "cases";
    const indexFile = path.join(project, cases, "index.html");
    fs.mkdirSync(path.dirname(indexFile), { recursive: true });
    fs.writeFileSync(indexFile, renderCollectionIndex(nextConfig));
  }
  if (args.github) syncGithub(repo, topics);
  console.log("Catalog applied to config and README.");
  if (args.github) console.log("GitHub Topics synced.");
} catch (error) {
  console.error(`catalog-project failed: ${error.message}`);
  process.exit(1);
}
