#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skill = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(skill, "scripts", "catalog-project.mjs");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "yah-catalog-"));
const project = path.join(fixture, "catalog-fixture-clone");

function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: project,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

try {
  fs.mkdirSync(path.join(project, ".clone"), { recursive: true });
  fs.writeFileSync(path.join(project, "README.md"), "# Catalog Fixture\n\nProject intro.\n\n## 本地预览\n\nnpm run dev\n");
  fs.writeFileSync(path.join(project, ".clone", "project.json"), `${JSON.stringify({
    schemaVersion: 3,
    name: "catalog-fixture-clone",
    mode: "full",
    paths: { work: ".clone/work" },
    delivery: { githubOrg: "Creative-Web-Refs" },
  }, null, 2)}\n`);

  const options = [
    "--project", project,
    "--technology", "Three.js, WebGL2, GLSL",
    "--capability", "interactive 3d,gpu-simulation",
    "--visual-style", "underwater,organic motion",
    "--subject", "coral,marine-life",
    "--artifact", "hero,brand site",
    "--asset-type", "3d-model,texture",
    "--industry", "technology",
    "--palette", "dark,blue",
    "--platform", "web",
    "--builder", "custom",
    "--keywords", "水下珊瑚,海洋生物,GPU 动画",
  ];
  const dryRun = run(options);
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  assert.match(dryRun.stdout, /Dry run only/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(project, ".clone", "project.json"))).catalog, undefined);

  const applied = run([...options, "--apply"]);
  assert.equal(applied.status, 0, applied.stderr || applied.stdout);
  const state = JSON.parse(fs.readFileSync(path.join(project, ".clone", "project.json")));
  assert.deepEqual(state.catalog.tags.technology, ["three-js", "webgl2", "glsl"]);
  assert.deepEqual(state.catalog.tags.capability, ["interactive-3d", "gpu-simulation"]);
  assert.equal(state.catalog.schemaVersion, 2);
  assert.deepEqual(state.catalog.facets.artifact, ["hero", "brand-site"]);
  assert.deepEqual(state.catalog.facets.assetType, ["3d-model", "texture"]);
  assert.deepEqual(state.catalog.facets.palette, ["dark", "blue"]);
  assert.deepEqual(state.catalog.keywords, ["水下珊瑚", "海洋生物", "GPU 动画"]);
  const readme = fs.readFileSync(path.join(project, "README.md"), "utf8");
  assert.equal((readme.match(/yah-catalog:start/g) || []).length, 1);
  assert.match(readme, /## 检索摘要/);
  assert.match(readme, /`three-js` · `webgl2`/);
  assert.match(readme, /完整 tags、facets 与关键词见 \[`clone\.config\.json`\]/);
  assert.doesNotMatch(readme, /形态：|素材：|关键词：/);

  const invalid = run(["--project", project, "--technology", "yah-web-clone"]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /系统标签/);

  const fakeBin = path.join(fixture, "bin");
  const ghArgs = path.join(fixture, "gh-args.txt");
  const ghInput = path.join(fixture, "gh-input.json");
  fs.mkdirSync(fakeBin);
  const fakeGh = path.join(fakeBin, "gh");
  fs.writeFileSync(fakeGh, "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$YAH_TEST_GH_ARGS\"\ncat > \"$YAH_TEST_GH_INPUT\"\n");
  fs.chmodSync(fakeGh, 0o755);
  const synced = run(["--project", project, "--github", "--apply"], {
    PATH: `${fakeBin}:${process.env.PATH}`,
    YAH_TEST_GH_ARGS: ghArgs,
    YAH_TEST_GH_INPUT: ghInput,
  });
  assert.equal(synced.status, 0, synced.stderr || synced.stdout);
  assert.match(fs.readFileSync(ghArgs, "utf8"), /repos\/Creative-Web-Refs\/catalog-fixture-clone\/topics/);
  const payload = JSON.parse(fs.readFileSync(ghInput, "utf8"));
  assert.deepEqual(payload.names, [
    "three-js", "webgl2", "glsl", "interactive-3d", "gpu-simulation",
    "underwater", "organic-motion", "coral", "marine-life",
  ]);

  const facetsOnly = run([
    "--project", project,
    "--technology", "", "--capability", "", "--visual-style", "", "--subject", "",
    "--artifact", "hero", "--asset-type", "3d-model", "--palette", "dark", "--platform", "web",
    "--keywords", "珊瑚模型,深色首屏", "--apply",
  ]);
  assert.equal(facetsOnly.status, 0, facetsOnly.stderr || facetsOnly.stdout);
  const facetsOnlyState = JSON.parse(fs.readFileSync(path.join(project, ".clone", "project.json")));
  assert.deepEqual(facetsOnlyState.catalog.tags.technology, []);
  assert.deepEqual(facetsOnlyState.catalog.facets.assetType, ["3d-model"]);
  const facetsOnlyReadme = fs.readFileSync(path.join(project, "README.md"), "utf8");
  assert.match(facetsOnlyReadme, /`hero`/);
  assert.match(facetsOnlyReadme, /`3d-model`/);

  state.mode = "collection";
  state.collection = {
    schemaVersion: 1,
    slug: "catalog-fixture",
    title: "Catalog Fixture",
    members: [{
      slug: "sunlit",
      title: "Sunlit",
      url: "https://example.com/sunlit",
      treatment: "effect",
      status: "analyzed",
      provider: "supahero",
      sourcePage: "https://supahero.io/example",
      assets: [{
        title: "Coral model reference",
        type: "3d-model",
        role: "reference",
        url: "https://assets.example.com/coral.glb",
        sourcePage: "https://assets.example.com/coral",
        license: "CC-BY-4.0",
        previewUrl: "https://assets.example.com/coral.webp",
      }],
    }],
  };
  fs.writeFileSync(path.join(project, ".clone", "project.json"), `${JSON.stringify(state, null, 2)}\n`);
  const memberApplied = run([
    "--project", project,
    "--case", "sunlit",
    "--capability", "dappled light",
    "--subject", "sunlight",
    "--artifact", "hero",
    "--platform", "web",
    "--keywords", "树影,自然光",
    "--apply",
  ]);
  assert.equal(memberApplied.status, 0, memberApplied.stderr || memberApplied.stdout);
  const collectionState = JSON.parse(fs.readFileSync(path.join(project, ".clone", "project.json")));
  assert.deepEqual(collectionState.collection.members[0].catalog.tags.capability, ["dappled-light"]);
  assert.deepEqual(collectionState.collection.members[0].catalog.facets.artifact, ["hero"]);
  const collectionReadme = fs.readFileSync(path.join(project, "README.md"), "utf8");
  assert.match(collectionReadme, /## 参考来源/);
  assert.match(collectionReadme, /supahero\.io\/example/);
  assert.doesNotMatch(collectionReadme, /### 案例分类|计划发布/);
  const casesIndex = fs.readFileSync(path.join(project, "cases", "index.html"), "utf8");
  assert.match(casesIndex, /supahero\.io\/example/);
  assert.match(casesIndex, /assets\.example\.com\/coral\.webp/);
  fs.writeFileSync(path.join(project, "cases", "index.html"), "<h1>stale</h1>");
  const syncedCollection = spawnSync(process.execPath, [
    path.join(skill, "scripts", "yah.mjs"),
    "collection", "sync", "--project", project, "--apply",
  ], { cwd: project, encoding: "utf8" });
  assert.equal(syncedCollection.status, 0, syncedCollection.stderr || syncedCollection.stdout);
  assert.match(fs.readFileSync(path.join(project, "cases", "index.html"), "utf8"), /supahero\.io\/example/);

  const curated = run(["--project", project, "--github-topics", "dappled-light", "--apply"]);
  assert.equal(curated.status, 0, curated.stderr || curated.stdout);
  const memberSynced = run(["--project", project, "--github", "--apply"], {
    PATH: `${fakeBin}:${process.env.PATH}`,
    YAH_TEST_GH_ARGS: ghArgs,
    YAH_TEST_GH_INPUT: ghInput,
  });
  assert.equal(memberSynced.status, 0, memberSynced.stderr || memberSynced.stdout);
  const collectionPayload = JSON.parse(fs.readFileSync(ghInput, "utf8"));
  assert.deepEqual(collectionPayload.names, ["dappled-light"]);

  console.log("catalog project and GitHub topic projection: OK");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
