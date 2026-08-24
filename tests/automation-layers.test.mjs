#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skill = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const yah = path.join(skill, "scripts", "yah.mjs");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "yah-automation-"));
const project = path.join(fixture, "automation-clone");
const configFile = path.join(fixture, "missing-config.json");

function run(args, cwd = fixture) {
  return spawnSync(process.execPath, [yah, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, YAH_WEB_CLONE_CONFIG: configFile },
  });
}

try {
  const init = run(["init", "automation", "--url", "https://example.com/immersive", "--mode", "mirror", "--root", fixture]);
  assert.equal(init.status, 0, init.stderr || init.stdout);

  const discovery = run(["discover", "--project", project, "--offline", "--apply"]);
  assert.equal(discovery.status, 0, discovery.stderr || discovery.stdout);
  const discoveryData = JSON.parse(fs.readFileSync(path.join(project, ".clone", "evidence", "discovery.json")));
  assert.ok(discoveryData.candidates.some((item) => item.scope === "inspiration" && item.provider === "mesh3d"));
  let state = JSON.parse(fs.readFileSync(path.join(project, ".clone", "project.json")));
  assert.equal(state.stages.source_discovery.status, "in_progress");

  const preview = run(["run", "--project", project, "--offline"]);
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  assert.match(preview.stdout, /builtin:discover/);

  const source = run([
    "source", "--project", project, "--no-match", "--scope", "code",
    "--note", "Checked project identity, internal repositories, GitHub, npm, and credits; use deployment assets.",
  ]);
  assert.equal(source.status, 0, source.stderr || source.stdout);
  const resumed = run(["resume", "--project", project, "--offline", "--apply"]);
  assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
  assert.match(resumed.stdout, /manual-required/);
  state = JSON.parse(fs.readFileSync(path.join(project, ".clone", "project.json")));
  assert.equal(state.stages.source_discovery.status, "completed");
  assert.equal(state.stages.mirror.status, "in_progress");
  assert.ok(fs.existsSync(path.join(project, ".clone", "evidence", "automation-runs.json")));

  const catalog = run([
    "catalog", "--project", project,
    "--technology", "webgl", "--capability", "interactive-3d",
    "--visual-style", "immersive", "--artifact", "interactive-experience",
    "--asset-type", "3d-model", "--platform", "web", "--keywords", "沉浸式网站,3D 场景", "--apply",
  ]);
  assert.equal(catalog.status, 0, catalog.stderr || catalog.stdout);

  const index = run(["index", "--root", fixture, "--json"]);
  assert.equal(index.status, 0, index.stderr || index.stdout);
  const indexData = JSON.parse(index.stdout);
  assert.equal(indexData.projectCount, 1);
  assert.ok(indexData.records.some((item) => item.name === "automation-clone"));

  const search = run(["search", "沉浸式", "--root", fixture, "--technology", "webgl", "--json"]);
  assert.equal(search.status, 0, search.stderr || search.stdout);
  const searchData = JSON.parse(search.stdout);
  assert.equal(searchData.resultCount, 1);
  assert.equal(searchData.results[0].name, "automation-clone");

  const exported = run(["export", "--project", project, "--format", "sune-library"]);
  assert.equal(exported.status, 0, exported.stderr || exported.stdout);
  const card = JSON.parse(exported.stdout);
  assert.equal(card.status, "candidate");
  assert.equal(card.resource_type, "Past Work");
  assert.deepEqual(card.tags.technology, ["webgl"]);
  assert.match(card.notes, /Sune Library remains/);

  const cardFile = path.join(fixture, "candidate.json");
  const unsafeWrite = run(["export", "--project", project, "--out", cardFile]);
  assert.equal(unsafeWrite.status, 1);
  assert.ok(!fs.existsSync(cardFile));
  const explicitWrite = run(["export", "--project", project, "--out", cardFile, "--apply"]);
  assert.equal(explicitWrite.status, 0, explicitWrite.stderr || explicitWrite.stdout);
  assert.ok(fs.existsSync(cardFile));

  state.skillVersion = "3.1";
  state.stages.recon = state.stages.capture;
  delete state.stages.capture;
  fs.writeFileSync(path.join(project, ".clone", "project.json"), `${JSON.stringify(state, null, 2)}\n`);
  const migration = run(["migrate", "--project", project, "--apply"]);
  assert.equal(migration.status, 0, migration.stderr || migration.stdout);
  const migrated = JSON.parse(fs.readFileSync(path.join(project, ".clone", "project.json")));
  assert.equal(migrated.skillVersion, "3.8");
  assert.ok(migrated.stages.capture);
  assert.equal(migrated.catalog.schemaVersion, 2);

  console.log("discovery, workspace retrieval, Library export, and resumable automation: OK");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
