#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skill = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "yah-default-mode-"));
const emptyConfig = path.join(fixture, "missing-config.json");

try {
  const result = spawnSync(process.execPath, [
    path.join(skill, "scripts", "init-clone.mjs"),
    "default-mode",
    "--url", "https://example.com",
    "--root", fixture,
    "--authorized",
  ], {
    cwd: fixture,
    encoding: "utf8",
    env: { ...process.env, YAH_WEB_CLONE_CONFIG: emptyConfig },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = JSON.parse(fs.readFileSync(path.join(fixture, "default-mode-clone", ".clone", "project.json")));
  assert.equal(state.mode, "full");
  assert.equal(state.requiredStages[0], "source_discovery");
  assert.equal(state.stages.source_discovery.status, "pending");
  assert.ok(fs.existsSync(path.join(fixture, "default-mode-clone", "site")));
  assert.ok(fs.existsSync(path.join(fixture, "default-mode-clone", "lab")));
  assert.ok(fs.existsSync(path.join(fixture, "default-mode-clone", "docs")));
  const readme = fs.readFileSync(path.join(fixture, "default-mode-clone", "README.md"), "utf8");
  assert.doesNotMatch(readme, /授权/);

  const collectionResult = spawnSync(process.execPath, [
    path.join(skill, "scripts", "init-clone.mjs"),
    "auto-collection-clone",
    "--url", "https://example.com/a",
    "--url", "https://example.org/b",
    "--root", fixture,
  ], {
    cwd: fixture,
    encoding: "utf8",
    env: { ...process.env, YAH_WEB_CLONE_CONFIG: emptyConfig },
  });
  assert.equal(collectionResult.status, 0, collectionResult.stderr || collectionResult.stdout);
  const collectionRoot = path.join(fixture, "auto-collection");
  const collectionState = JSON.parse(fs.readFileSync(path.join(collectionRoot, ".clone", "project.json")));
  assert.equal(collectionState.mode, "collection");
  assert.equal(collectionState.requiredStages[0], "source_discovery");
  assert.equal(collectionState.collection.members.length, 2);
  assert.ok(fs.existsSync(path.join(collectionRoot, "cases", "index.html")));
  assert.ok(!fs.existsSync(path.join(collectionRoot, "site")));
  console.log("default mode case: OK");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
