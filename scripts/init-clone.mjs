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

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.dirname(scriptDir);

function usage() {
  console.log(`Usage:
  node scripts/init-clone.mjs <slug> --url <url> [options]

Modes:
  full    1:1 mirror + Chinese analysis + key screenshots + runnable effect lab (default)
  mirror  Local runnable mirror only; no teardown or effect lab
  effect  Reproduce one named effect as a standalone runnable lab

Options:
  --mode <full|mirror|effect>
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
    url: "",
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
    else if (arg === "--url") out.url = argv[++i] || "";
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

function projectName(slug) {
  const base = slug.replace(/(?:-clone|-mirror)+$/g, "") || slug;
  return `${base}-clone`;
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
  }[mode];
}

function readmeTemplate({ name, url, mode, effect, publishTargets }) {
  const surfaces = [];
  if (mode !== "effect") surfaces.push("- `site/`：保持原站行为的可运行镜像，不放调试 GUI 或教学改写。");
  if (mode !== "mirror") surfaces.push("- `lab/`：独立可运行的效果复刻、参数 GUI 和 Preset，不依赖 Storybook。");
  if (mode !== "mirror") surfaces.push("- `docs/`：中文分析与少量关键截图；过程缓存不会放在这里。");
  surfaces.push("- `.clone/`：仅在工作过程中保存状态、精简证据和临时文件；最终会把长期内容提升后删除。");
  const preview = mode === "effect"
    ? "启动后打开终端显示的 Lab 地址。"
    : mode === "full"
      ? "启动后 `/` 预览镜像，`/__lab/` 预览效果实验室。"
      : "启动后 `/` 预览本地镜像。";
  const publishing = publishTargets.length
    ? `计划发布：${publishTargets.join("、")}。`
    : "GitHub 与部署未启用；本地验收后再决定是否发布。";

  return `# ${name}

> Yah Web Clone v3 · ${modeLabel(mode)}${effect ? ` · ${effect}` : ""}

## 来源与状态

- 原站：${url || "待补"}
- ${publishing}

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

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.slug) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const slug = cleanSlug(args.slug);
  if (!slug) throw new Error("Slug is empty after normalization.");
  const name = projectName(slug);
  const config = loadYahConfig({ overrideRoot: args.root });
  const mode = normalizeMode(args.mode || config.defaultMode || "full");
  if (mode === "effect" && !args.effect.trim()) throw new Error("effect mode requires --effect <name>.");
  const publishTargets = parsePublishTargets(args.publish, config.publishTargets || []);
  const project = path.join(config.workspaceRoot, name);

  if (fs.existsSync(project)) throw new Error(`Project already exists: ${project}`);

  fs.mkdirSync(path.join(project, ".clone", "evidence"), { recursive: true });
  fs.mkdirSync(path.join(project, ".clone", "work"), { recursive: true });
  if (mode !== "effect") fs.mkdirSync(path.join(project, "site"), { recursive: true });
  if (mode !== "mirror") {
    fs.mkdirSync(path.join(project, "lab", "effects"), { recursive: true });
    fs.mkdirSync(path.join(project, "docs", "media"), { recursive: true });
    fs.writeFileSync(path.join(project, "lab", "index.html"), labIndex({ name, effect: args.effect }));
    fs.writeFileSync(
      path.join(project, "docs", "ANALYSIS.md"),
      analysisTemplate({ name, url: args.url, mode, effect: args.effect })
    );
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
    readmeTemplate({ name, url: args.url, mode, effect: args.effect, publishTargets })
  );
  const packageScripts = {
    dev: "node .clone/serve.mjs",
    "build:deploy": "node .clone/prepare-deploy.mjs",
  };
  if (mode !== "effect") packageScripts.site = "node .clone/serve.mjs --surface site";
  if (mode !== "mirror") packageScripts.lab = "node .clone/serve.mjs --surface lab";
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
    url: args.url,
    mode,
    effect: args.effect.trim(),
    authorization: args.authorized ? "explicitly-authorized" : "unknown",
    publishTargets,
    config: { ...config, complexityLevel: args.level },
  }));

  console.log(project);
} catch (error) {
  console.error(`init-clone failed: ${error.message}`);
  process.exit(1);
}
