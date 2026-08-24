#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skill = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "yah-source-discovery-"));
const project = path.join(fixture, "source-discovery-clone");
const configFile = path.join(fixture, "missing-config.json");

function run(args) {
  return spawnSync(process.execPath, [path.join(skill, "scripts", "yah.mjs"), ...args], {
    encoding: "utf8",
    env: { ...process.env, YAH_WEB_CLONE_CONFIG: configFile },
  });
}

try {
  const initialized = run([
    "init", "source-discovery", "--url", "https://example.com", "--mode", "mirror", "--root", fixture,
  ]);
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);

  const unsafeDefault = run([
    "source",
    "--project", project,
    "--kind", "repository",
    "--source", "https://github.com/example/source",
    "--path", "site",
  ]);
  assert.equal(unsafeDefault.status, 1);
  assert.match(unsafeDefault.stderr, /requires --kind, --source, --path, --relation, and --evidence/);

  const optionalRevision = run([
    "source", "--project", project, "--kind", "repository",
    "--source", "https://github.com/example/source", "--path", "site",
    "--relation", "exact", "--evidence", "SOURCE",
  ]);
  assert.equal(optionalRevision.status, 0, optionalRevision.stderr || optionalRevision.stdout);

  const result = run([
    "source", "--project", project, "--kind", "repository",
    "--source", "https://github.com/example/source", "--revision", "abc123",
    "--license", "MIT", "--relation", "exact", "--path", "site",
    "--evidence", "SOURCE", "--complete",
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const data = JSON.parse(fs.readFileSync(path.join(project, ".clone", "evidence", "source-provenance.json")));
  assert.equal(data.sources.length, 2);
  assert.deepEqual(data.sources[1], {
    kind: "repository",
    source: "https://github.com/example/source",
    revision: "abc123",
    checksum: "",
    license: "MIT",
    relation: "exact",
    path: "site",
    evidence: "SOURCE",
    recordedAt: data.sources[1].recordedAt,
  });
  const state = JSON.parse(fs.readFileSync(path.join(project, ".clone", "project.json")));
  assert.equal(state.stages.source_discovery.status, "completed");

  const exactAsset = run([
    "source", "--project", project, "--kind", "asset",
    "--source", "https://assets.example.com/coral.glb", "--path", "site/assets/coral.glb",
    "--role", "original", "--relation", "exact", "--evidence", "SOURCE",
  ]);
  assert.equal(exactAsset.status, 0, exactAsset.stderr || exactAsset.stdout);

  const replacementAsset = run([
    "source", "--project", project, "--kind", "asset",
    "--source", "https://assets.example.com/replacement.glb", "--path", "site/assets/replacement.glb",
    "--license", "CC0-1.0", "--role", "replacement", "--relation", "partial", "--evidence", "PARTIAL",
  ]);
  assert.equal(replacementAsset.status, 0, replacementAsset.stderr || replacementAsset.stdout);

  const invalid = run([
    "source",
    "--project", project,
    "--kind", "repository",
    "--source", "https://github.com/example/related",
    "--relation", "similar",
    "--path", "lab",
    "--evidence", "PARTIAL",
  ]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Invalid --relation/);

  const noMatchProject = path.join(fixture, "no-match-clone");
  const noMatchInit = run([
    "init", "no-match", "--url", "https://example.org", "--mode", "mirror", "--root", fixture,
  ]);
  assert.equal(noMatchInit.status, 0, noMatchInit.stderr || noMatchInit.stdout);
  const noMatch = run([
    "source", "--project", noMatchProject, "--no-match", "--scope", "code",
    "--note", "Checked domain, title, credits, GitHub, CodePen, and npm; continue with deployment assets.", "--complete",
  ]);
  assert.equal(noMatch.status, 0, noMatch.stderr || noMatch.stdout);
  const noMatchData = JSON.parse(fs.readFileSync(path.join(noMatchProject, ".clone", "evidence", "source-provenance.json")));
  assert.equal(noMatchData.searches[0].outcome, "not-found");
  const noMatchState = JSON.parse(fs.readFileSync(path.join(noMatchProject, ".clone", "project.json")));
  assert.equal(noMatchState.stages.source_discovery.status, "completed");

  const assetOnlyProject = path.join(fixture, "asset-only-clone");
  const assetOnlyInit = run([
    "init", "asset-only", "--url", "https://assets.example.net", "--mode", "mirror", "--root", fixture,
  ]);
  assert.equal(assetOnlyInit.status, 0, assetOnlyInit.stderr || assetOnlyInit.stdout);
  fs.writeFileSync(path.join(assetOnlyProject, "site", "index.html"), "<h1>Asset fixture</h1>");
  const assetOnlySource = run([
    "source", "--project", assetOnlyProject, "--kind", "asset",
    "--source", "https://assets.example.net/model.glb", "--path", "site/model.glb",
    "--role", "original", "--relation", "exact", "--evidence", "SOURCE", "--complete",
  ]);
  assert.equal(assetOnlySource.status, 0, assetOnlySource.stderr || assetOnlySource.stdout);
  const assetOnlyCatalog = run([
    "catalog", "--project", assetOnlyProject, "--artifact", "interactive-experience",
    "--asset-type", "3d-model", "--platform", "web", "--keywords", "内部模型", "--apply",
  ]);
  assert.equal(assetOnlyCatalog.status, 0, assetOnlyCatalog.stderr || assetOnlyCatalog.stdout);
  const assetOnlyValidation = run(["validate", "--project", assetOnlyProject, "--strict"]);
  assert.equal(assetOnlyValidation.status, 2);
  assert.match(assetOnlyValidation.stdout, /missing-code-discovery/);
  const assetOnlyCodeSearch = run([
    "source", "--project", assetOnlyProject, "--no-match", "--scope", "code",
    "--note", "Checked target identity and internal repositories; only deployment assets are available.",
  ]);
  assert.equal(assetOnlyCodeSearch.status, 0, assetOnlyCodeSearch.stderr || assetOnlyCodeSearch.stdout);
  const completeValidation = run(["validate", "--project", assetOnlyProject, "--strict"]);
  assert.equal(completeValidation.status, 0, completeValidation.stderr || completeValidation.stdout);

  console.log("source discovery provenance: OK");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
