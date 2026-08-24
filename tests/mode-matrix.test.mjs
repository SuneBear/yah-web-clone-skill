#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skill = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "yah-mode-matrix-"));
const configFile = path.join(fixture, "missing-config.json");

function run(script, args, cwd = fixture) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, YAH_WEB_CLONE_CONFIG: configFile },
  });
}

function analysis() {
  return `# 实现分析

## 来源与证据
SOURCE：运行证据已保存。

## 参数与 Preset
默认参数为原版基线，另有三个 variation。

## 原版与复刻差异
当前没有已知缺口。

## 迁移说明
效果源码可独立复用。
`;
}

function completeState(project) {
  const file = path.join(project, ".clone", "project.json");
  const state = JSON.parse(fs.readFileSync(file));
  for (const stage of state.requiredStages) {
    state.stages[stage] = { status: "completed", updatedAt: new Date().toISOString(), note: "test" };
  }
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

function prepareMode(mode) {
  const slug = `matrix-${mode}`;
  const args = [slug, "--url", "https://example.com", "--root", fixture, "--mode", mode, "--authorized"];
  if (mode === "effect") args.push("--effect", "Demo Effect");
  if (mode === "collection") args.push("--url", "https://example.org");
  const initialized = run(path.join(skill, "scripts", "init-clone.mjs"), args);
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  const project = initialized.stdout.trim().split(/\r?\n/).at(-1);

  fs.mkdirSync(path.join(project, ".clone", "evidence"), { recursive: true });
  fs.writeFileSync(path.join(project, ".clone", "evidence", "source-provenance.json"), `${JSON.stringify({
    schemaVersion: 3,
    sources: [],
    searches: [{
      scope: "code",
      outcome: "not-found",
      note: "Checked domain, title, credits, GitHub, CodePen, and npm for the fixture.",
      recordedAt: new Date().toISOString(),
    }],
  }, null, 2)}\n`);
  if (["full", "mirror"].includes(mode)) fs.writeFileSync(path.join(project, "site", "index.html"), `<h1>${mode}</h1>`);
  if (["full", "effect"].includes(mode)) {
    const effect = path.join(project, "lab", "effects", "demo");
    fs.mkdirSync(effect, { recursive: true });
    fs.writeFileSync(path.join(effect, "index.html"), '<script type="module" src="./app.js"></script>');
    fs.writeFileSync(path.join(effect, "app.js"), "document.body.textContent = 'independent effect';\n");
    fs.writeFileSync(path.join(project, "docs", "ANALYSIS.md"), analysis());
    fs.writeFileSync(path.join(project, "docs", "media", "demo.png"), "fixture");
  }
  if (mode === "collection") {
    const stateFile = path.join(project, ".clone", "project.json");
    const state = JSON.parse(fs.readFileSync(stateFile));
    state.collection.members = state.collection.members.map((member) => ({ ...member, status: "analyzed" }));
    fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
    fs.writeFileSync(path.join(project, "docs", "COMPARISON.md"), "# 横向比较\n\n| 案例 | 共性 | 差异 |\n|---|---|---|\n| A | 光 | 暖 |\n| B | 光 | 冷 |\n");
    fs.writeFileSync(path.join(project, "docs", "SYNTHESIS.md"), "# 综合结论\n\n## 共性\n都使用光。\n\n## 差异与反例\n色温不同。\n\n## 可迁移方法\n复用光照模型。\n");
    for (const slug of ["example-com", "example-org"]) {
      fs.writeFileSync(path.join(project, "docs", "cases", `${slug}.md`), `# ${slug}\n\n## 来源与证据\nSOURCE：已验证。\n\n## 与集合的关系\n支持光照共性，并记录差异与反例。\n`);
    }
  }
  const cataloged = run(path.join(skill, "scripts", "catalog-project.mjs"), [
    "--project", project,
    "--capability", "interactive-page",
    "--subject", "test-fixture",
    "--apply",
  ]);
  assert.equal(cataloged.status, 0, cataloged.stderr || cataloged.stdout);
  if (mode === "collection") {
    for (const slug of ["example-com", "example-org"]) {
      const memberCatalog = run(path.join(skill, "scripts", "catalog-project.mjs"), [
        "--project", project,
        "--case", slug,
        "--capability", "interactive-page",
        "--subject", slug,
        "--apply",
      ]);
      assert.equal(memberCatalog.status, 0, memberCatalog.stderr || memberCatalog.stdout);
    }
  }
  completeState(project);
  return project;
}

try {
  for (const mode of ["full", "mirror", "effect", "collection"]) {
    const project = prepareMode(mode);
    const validation = run(path.join(skill, "scripts", "validate-deliverables.mjs"), ["--project", project, "--strict"], project);
    assert.equal(validation.status, 0, `${mode}: ${validation.stderr || validation.stdout}`);

    const finalized = run(path.join(skill, "scripts", "finalize-project.mjs"), ["--project", project, "--apply"], project);
    assert.equal(finalized.status, 0, `${mode}: ${finalized.stderr || finalized.stdout}`);
    assert.ok(!fs.existsSync(path.join(project, ".clone")), `${mode}: .clone should be removed`);
    assert.ok(fs.existsSync(path.join(project, "docs", "evidence", "source-provenance.json")));
    assert.ok(fs.existsSync(path.join(project, "dist", "index.html")));
    if (mode === "full") assert.ok(fs.existsSync(path.join(project, "dist", "__lab", "index.html")));
    if (mode === "mirror") assert.ok(!fs.existsSync(path.join(project, "dist", "__lab")));
    if (mode === "effect") assert.match(fs.readFileSync(path.join(project, "dist", "index.html"), "utf8"), /Runnable Effect Lab/);
    if (mode === "collection") {
      assert.equal(path.basename(project), "matrix-collection");
      assert.match(fs.readFileSync(path.join(project, "dist", "index.html"), "utf8"), /Yah Web Clone · Collection/);
      assert.ok(!fs.existsSync(path.join(project, "dist", "__lab")));
      const config = JSON.parse(fs.readFileSync(path.join(project, "clone.config.json")));
      assert.equal(config.collection.members.length, 2);
    }
  }
  console.log("mode matrix: full, mirror, effect, collection OK");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
