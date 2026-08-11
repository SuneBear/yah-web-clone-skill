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
  assert.deepEqual(state.catalog.keywords, ["水下珊瑚", "海洋生物", "GPU 动画"]);
  const readme = fs.readFileSync(path.join(project, "README.md"), "utf8");
  assert.equal((readme.match(/yah-catalog:start/g) || []).length, 1);
  assert.match(readme, /## 分类/);
  assert.match(readme, /关键词：水下珊瑚、海洋生物、GPU 动画/);

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

  console.log("catalog project and GitHub topic projection: OK");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
