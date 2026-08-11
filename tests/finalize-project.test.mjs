#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skill = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "yah-finalize-"));
const project = path.join(fixture, "fixture-clone");

function run(script, args, cwd = fixture) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
}

try {
  fs.mkdirSync(path.join(project, ".clone", "evidence"), { recursive: true });
  fs.mkdirSync(path.join(project, ".clone", "work"), { recursive: true });
  fs.mkdirSync(path.join(project, "site"), { recursive: true });
  fs.mkdirSync(path.join(project, "lab", "effects", "demo"), { recursive: true });
  fs.mkdirSync(path.join(project, "docs"), { recursive: true });
  fs.writeFileSync(path.join(project, "site", "index.html"), "<h1>Site</h1>");
  fs.writeFileSync(path.join(project, "lab", "index.html"), "<a href='./effects/demo/'>Demo</a>");
  fs.writeFileSync(path.join(project, "lab", "effects", "demo", "index.html"), "<h1>Demo</h1>");
  fs.writeFileSync(path.join(project, "lab", "effects", "demo", "app.js"), "document.body.dataset.ready = 'true';\n");
  fs.writeFileSync(path.join(project, ".clone", "evidence", "verification.json"), '{"ok":true}\n');
  fs.writeFileSync(path.join(project, "README.md"), "Evidence: `.clone/evidence/`; deploy `.clone/work/publish/`.\n");
  fs.mkdirSync(path.join(project, "docs", "media"), { recursive: true });
  fs.writeFileSync(path.join(project, "docs", "media", "demo.png"), "fixture");
  fs.writeFileSync(path.join(project, "docs", "ANALYSIS.md"), `# 分析

## 来源与证据
SOURCE：见 .clone/evidence/verification.json。

## 参数与 Preset
默认参数忠实于原版。

## 原版与复刻差异
没有已知缺口。

## 迁移说明
复制效果源码即可复用。
`);
  fs.writeFileSync(path.join(project, ".gitignore"), ".clone/work/\nnode_modules/\n");
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({
    name: "fixture-clone",
    private: true,
    scripts: {
      dev: "node .clone/serve.mjs",
      "build:deploy": "node .clone/prepare-deploy.mjs",
    },
  }));
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(project, ".clone", "project.json"), JSON.stringify({
    schemaVersion: 3,
    skillVersion: "3.1",
    project,
    name: "fixture-clone",
    url: "https://example.com",
    mode: "full",
    authorization: "explicitly-authorized",
    paths: { runnableMirror: "site", runnableLab: "lab", humanDocs: "docs" },
    contract: { fidelity: "site-1-to-1" },
    catalog: {
      schemaVersion: 1,
      tags: {
        technology: ["webgl"],
        capability: ["interactive-3d"],
        visualStyle: ["immersive"],
        subject: ["demo"],
      },
      keywords: ["交互演示"],
    },
    limits: { maxProjectSizeMB: 20, maxSingleFileMB: 5 },
    delivery: { labMountPath: "__lab" },
    requiredStages: ["mirror", "local_verify", "docs"],
    stages: {
      mirror: { status: "completed", updatedAt: now },
      local_verify: { status: "completed", updatedAt: now },
      docs: { status: "completed", updatedAt: now },
    },
    createdAt: now,
    updatedAt: now,
  }));

  const catalog = run(path.join(skill, "scripts", "catalog-project.mjs"), ["--project", project, "--apply"]);
  assert.equal(catalog.status, 0, catalog.stderr || catalog.stdout);

  const finalize = path.join(skill, "scripts", "finalize-project.mjs");
  const dryRun = run(finalize, ["--project", project]);
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  assert.ok(fs.existsSync(path.join(project, ".clone")));

  const applied = run(finalize, ["--project", project, "--apply"]);
  assert.equal(applied.status, 0, applied.stderr || applied.stdout);
  assert.ok(!fs.existsSync(path.join(project, ".clone")));
  assert.ok(fs.existsSync(path.join(project, "docs", "evidence", "verification.json")));
  assert.ok(fs.existsSync(path.join(project, "docs", "evidence", "workflow-summary.json")));
  assert.ok(fs.existsSync(path.join(project, "scripts", "serve.mjs")));
  assert.ok(fs.existsSync(path.join(project, "scripts", "prepare-deploy.mjs")));
  assert.ok(fs.existsSync(path.join(project, "dist", "index.html")));
  assert.ok(fs.existsSync(path.join(project, "dist", "__lab", "effects", "demo", "index.html")));

  const configText = fs.readFileSync(path.join(project, "clone.config.json"), "utf8");
  const config = JSON.parse(configText);
  assert.equal(config.mode, "full");
  assert.equal(config.paths.evidence, "docs/evidence");
  assert.equal(config.paths.publishOutput, "dist");
  assert.deepEqual(config.catalog.tags.technology, ["webgl"]);
  assert.ok(!configText.includes(project));
  const pkg = JSON.parse(fs.readFileSync(path.join(project, "package.json"), "utf8"));
  assert.equal(pkg.scripts.dev, "node scripts/serve.mjs");
  assert.equal(pkg.scripts["build:deploy"], "node scripts/prepare-deploy.mjs");
  const readme = fs.readFileSync(path.join(project, "README.md"), "utf8");
  assert.match(readme, /docs\/evidence\//);
  assert.match(readme, /dist\//);

  const size = run(path.join(skill, "scripts", "project-size.mjs"), ["--project", project]);
  assert.equal(size.status, 0, size.stderr || size.stdout);
  console.log("finalize project case: OK");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
