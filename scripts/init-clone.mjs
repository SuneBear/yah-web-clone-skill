#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadYahConfig } from "./lib/workspace-config.mjs";
import {
  PROJECT_MODES,
  createProjectState,
  writeProjectState,
} from "./lib/project-state.mjs";
import { renderCollectionIndex, renderSourcesBlock } from "./lib/collection-projection.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.dirname(scriptDir);

function usage() {
  console.log(`Usage:
  node scripts/init-clone.mjs <slug> --url <url> [options]

Modes:
  full    1:1 mirror + Chinese analysis + key screenshots + runnable effect lab (default)
  mirror  Local runnable mirror only; no teardown or effect lab
  effect  Reproduce one named effect as a standalone runnable lab
  collection  Compare and organize multiple related references in one runnable study

Options:
  --mode <full|mirror|effect|collection>
  --url <url>                    Repeat for collection mode (at least two)
  --effect <name>                 Required for effect mode
  --authorized                    Record that cloning permission was explicitly confirmed
  --publish <none|github|cloudflare|all|csv>
  --root <dir>
  --level <L1-L6>                 Optional complexity note

Creates only the surfaces required by the selected mode. Every project runs from its root with:
  npm run dev
`);
}

function parseArgs(argv) {
  const out = {
    slug: null,
    urls: [],
    mode: "",
    effect: "",
    root: "",
    level: "",
    authorized: false,
    publish: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--url") out.urls.push(argv[++i] || "");
    else if (arg === "--mode") out.mode = argv[++i] || "";
    else if (arg === "--effect") out.effect = argv[++i] || "";
    else if (arg === "--root") out.root = argv[++i] || "";
    else if (arg === "--level") out.level = argv[++i] || "";
    else if (arg === "--authorized") out.authorized = true;
    else if (arg === "--publish") out.publish = argv[++i] ?? "";
    else if (!out.slug) out.slug = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function cleanSlug(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function projectName(slug, mode) {
  const base = slug.replace(/(?:-clone|-mirror)+$/g, "") || slug;
  return mode === "collection" ? base : `${base}-clone`;
}

function normalizeMode(input) {
  const aliases = { analysis: "full", study: "effect", research: "full" };
  const mode = aliases[input] || input;
  if (!PROJECT_MODES.includes(mode)) {
    throw new Error(`Invalid mode "${input}". Expected: ${PROJECT_MODES.join(", ")}`);
  }
  return mode;
}

function parsePublishTargets(input, fallback) {
  if (input === null) return fallback;
  if (!input || input === "none") return [];
  const expanded = input === "all" ? ["github", "cloudflare"] : input.split(",");
  const targets = [...new Set(expanded.map((value) => value.trim()).filter(Boolean))];
  const invalid = targets.filter((value) => !["github", "cloudflare"].includes(value));
  if (invalid.length) throw new Error(`Invalid publish target(s): ${invalid.join(", ")}`);
  return targets;
}

function modeLabel(mode) {
  return {
    full: "完整镜像与解构",
    mirror: "仅本地镜像",
    effect: "单效果复刻",
    collection: "多来源 Collection",
  }[mode];
}

function collectionMembers(urls) {
  const used = new Set();
  return urls.map((input, index) => {
    const url = new URL(input).href;
    const parsed = new URL(url);
    const seed = `${parsed.hostname.replace(/^www\./, "")}-${parsed.pathname}`;
    const base = cleanSlug(seed) || `case-${index + 1}`;
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    used.add(slug);
    return {
      slug,
      title: slug,
      url,
      treatment: "reference-only",
      status: "pending",
    };
  });
}

function readmeTemplate({ name, url, mode, effect, publishTargets, collection }) {
  const surfaces = [];
  if (["full", "mirror"].includes(mode)) surfaces.push("- `site/`：保持原站行为的可运行镜像，不放调试 GUI 或教学改写。");
  if (mode === "collection") surfaces.push("- `cases/`：Collection 列表与可运行成员入口；不堆放无筛选的完整抓取。");
  if (["full", "effect"].includes(mode)) surfaces.push("- `lab/`：独立可运行的效果复刻、参数 GUI 和 Preset，不依赖 Storybook。");
  if (mode === "collection") surfaces.push("- `lab/`：可选；只放跨案例提炼的可运行实验，存在时自动发布到 `/__lab/`。");
  if (mode !== "mirror") surfaces.push("- `docs/`：中文分析与少量关键截图；过程缓存不会放在这里。");
  surfaces.push("- `.clone/`：仅在工作过程中保存状态、精简证据和临时文件；最终会把长期内容提升后删除。");
  const preview = mode === "effect"
    ? "启动后打开终端显示的 Lab 地址。"
    : mode === "full"
      ? "启动后 `/` 预览镜像，`/__lab/` 预览效果实验室。"
      : mode === "collection"
        ? "启动后 `/` 预览 Collection；存在 Lab 时从 `/__lab/` 访问。"
      : "启动后 `/` 预览本地镜像。";
  const sources = renderSourcesBlock({ mode, url, collection, publishTargets });

  return `# ${name}

> Yah Web Clone v3 · ${modeLabel(mode)}${effect ? ` · ${effect}` : ""}

## 来源与状态

${sources}

## 本地预览

\`\`\`bash
npm run dev
\`\`\`

${preview}

## 目录

${surfaces.join("\n")}

## 验收

${mode === "mirror"
    ? "镜像仍按 1:1 标准验证；本模式只省略技术解构、GUI、Preset 和研究代码。"
    : mode === "collection"
      ? "逐项结论维护在 `docs/cases/`，横向比较与综合结论维护在 `docs/COMPARISON.md` 和 `docs/SYNTHESIS.md`。每个成员只按自己的 treatment 验收。"
      : "分析、关键截图、来源证据、忠实度结果与已知缺口在 `docs/ANALYSIS.md` 中维护。"}
`;
}

function analysisTemplate({ name, url, mode, effect }) {
  return `# ${name} · 实现分析

## 对象

- 原站：${url || "待补"}
- 模式：${mode}
- 效果：${effect || "按侦察结果选择关键效果"}

## 一句话原理

待补。

## 源码发现

记录克隆前检索过的官方仓库、作者仓库、部署仓库、CodePen/CodeSandbox 与相关实现；说明候选是否与目标精确对应、采用或排除理由。revision、license 与 checksum 有证据时记录，内部来源无需为了流程补填。不要把相似模板写成原站源码。

## 来源与证据

使用 \`SOURCE / PARTIAL / GUESS\` 标记关键结论，并链接到 \`.clone/evidence/\` 中的精简证据。

## 运行结构

待补渲染、时间线、输入、状态和资源依赖。

## 参数与 Preset

待补参数含义、默认值、边界与至少三个有辨识度的 Preset。只有需要实时调试时才加入 Dialkit。

## 原版与复刻差异

待补逐项差异；没有证据的值不得写成原站事实。

## 关键截图

只保留桌面、移动端和关键状态中真正有说明价值的图片。动效无法由截图表达且录制成本低时，再加入不超过配置时长的短录屏。

## 迁移说明

待补最小依赖、接口、坐标与时间单位，以及迁移到其他项目时不应携带的站点专属部分。
`;
}

function labIndex({ name, effect }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} · Effect Lab</title>
  <style>
    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; color: #eee; background: #111; }
    main { width: min(760px, calc(100% - 32px)); padding: 32px; border: 1px solid #333; background: #181818; }
    a { color: #a8d5a2; }
  </style>
</head>
<body>
  <main>
    <p>Yah Web Clone · Runnable Effect Lab</p>
    <h1>${effect || "效果索引待建立"}</h1>
    <p>把每个可独立运行的效果放入 <code>lab/effects/&lt;slug&gt;/index.html</code>，并在这里添加入口。</p>
  </main>
</body>
</html>
`;
}

function comparisonTemplate(members) {
  const rows = members.map((member) => `| ${member.title} | ${member.treatment} | 待补 | 待补 | 待补 |`).join("\n");
  return `# 横向比较

| 案例 | 处理方式 | 核心机制 | 视觉特征 | 差异与反例 |
|---|---|---|---|---|
${rows}
`;
}

function synthesisTemplate() {
  return `# 综合结论

## 研究问题

待补。

## 共性

待补。

## 差异与反例

待补。

## 可迁移方法

待补。
`;
}

function caseTemplate(member) {
  return `# ${member.title}

- 来源：${member.url}
- 处理方式：${member.treatment}
- 状态：${member.status}

## 观察与实现分析

待补。

## 来源与证据

待补，使用 \`SOURCE / PARTIAL / GUESS\` 标记。

## 与集合的关系

待补它支持、补充或反驳了什么共性。
`;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.slug) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const slug = cleanSlug(args.slug);
  if (!slug) throw new Error("Slug is empty after normalization.");
  const config = loadYahConfig({ overrideRoot: args.root });
  const urls = [...new Set(args.urls.map((url) => url.trim()).filter(Boolean))];
  const inferredMode = !args.mode && urls.length > 1 ? "collection" : "";
  const mode = normalizeMode(args.mode || inferredMode || config.defaultMode || "full");
  const name = projectName(slug, mode);
  if (mode === "effect" && !args.effect.trim()) throw new Error("effect mode requires --effect <name>.");
  if (mode === "collection" && urls.length < 2) throw new Error("collection mode requires at least two --url values.");
  if (mode !== "collection" && urls.length > 1) throw new Error("Multiple --url values require collection mode.");
  const collection = mode === "collection" ? {
    schemaVersion: 1,
    slug: name,
    title: name,
    members: collectionMembers(urls),
  } : null;
  const url = urls[0] || "";
  const publishTargets = parsePublishTargets(args.publish, config.publishTargets || []);
  const project = path.join(config.workspaceRoot, name);

  if (fs.existsSync(project)) throw new Error(`Project already exists: ${project}`);

  fs.mkdirSync(path.join(project, ".clone", "evidence"), { recursive: true });
  fs.mkdirSync(path.join(project, ".clone", "work"), { recursive: true });
  if (["full", "mirror"].includes(mode)) fs.mkdirSync(path.join(project, "site"), { recursive: true });
  if (["full", "effect"].includes(mode)) {
    fs.mkdirSync(path.join(project, "lab", "effects"), { recursive: true });
    fs.mkdirSync(path.join(project, "docs", "media"), { recursive: true });
    fs.writeFileSync(path.join(project, "lab", "index.html"), labIndex({ name, effect: args.effect }));
    fs.writeFileSync(
      path.join(project, "docs", "ANALYSIS.md"),
      analysisTemplate({ name, url, mode, effect: args.effect })
    );
  }
  if (mode === "collection") {
    fs.mkdirSync(path.join(project, "cases"), { recursive: true });
    fs.mkdirSync(path.join(project, "docs", "cases"), { recursive: true });
    fs.mkdirSync(path.join(project, "docs", "media"), { recursive: true });
    fs.writeFileSync(path.join(project, "cases", "index.html"), renderCollectionIndex({ name, mode, collection }));
    fs.writeFileSync(path.join(project, "docs", "COMPARISON.md"), comparisonTemplate(collection.members));
    fs.writeFileSync(path.join(project, "docs", "SYNTHESIS.md"), synthesisTemplate());
    for (const member of collection.members) {
      fs.writeFileSync(path.join(project, "docs", "cases", `${member.slug}.md`), caseTemplate(member));
    }
  }

  fs.copyFileSync(
    path.join(skillDir, "assets", "project", "serve.mjs"),
    path.join(project, ".clone", "serve.mjs")
  );
  fs.copyFileSync(
    path.join(skillDir, "assets", "project", "prepare-deploy.mjs"),
    path.join(project, ".clone", "prepare-deploy.mjs")
  );
  fs.writeFileSync(
    path.join(project, "README.md"),
    readmeTemplate({ name, url, mode, effect: args.effect, publishTargets, collection })
  );
  const packageScripts = {
    dev: "node .clone/serve.mjs",
    "build:deploy": "node .clone/prepare-deploy.mjs",
  };
  if (["full", "mirror"].includes(mode)) packageScripts.site = "node .clone/serve.mjs --surface site";
  if (["full", "effect"].includes(mode)) packageScripts.lab = "node .clone/serve.mjs --surface lab";
  if (mode === "collection") packageScripts.cases = "node .clone/serve.mjs --surface cases";
  fs.writeFileSync(path.join(project, "package.json"), `${JSON.stringify({
    name,
    private: true,
    scripts: packageScripts,
  }, null, 2)}\n`);
  fs.writeFileSync(
    path.join(project, ".gitignore"),
    [
      "node_modules/",
      ".DS_Store",
      ".clone/work/",
      "dist/",
      "dist.manifest.json",
      ".wrangler/",
      ".next/",
      ".nuxt/",
      ".svelte-kit/",
      ".astro/",
      ".vite/",
      ".cache/",
      "coverage/",
      "*.log",
      "*.tmp",
      "",
    ].join("\n")
  );

  writeProjectState(project, createProjectState({
    project,
    name,
    url,
    mode,
    effect: args.effect.trim(),
    collection,
    authorization: args.authorized ? "explicitly-authorized" : "unknown",
    publishTargets,
    config: { ...config, complexityLevel: args.level },
  }));

  console.log(project);
} catch (error) {
  console.error(`init-clone failed: ${error.message}`);
  process.exit(1);
}
