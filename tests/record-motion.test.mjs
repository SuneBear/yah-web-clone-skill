#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skill = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "yah-record-test-"));

try {
  fs.mkdirSync(path.join(fixture, ".clone", "work"), { recursive: true });
  fs.mkdirSync(path.join(fixture, ".clone", "evidence"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "site"), { recursive: true });
  fs.copyFileSync(path.join(skill, "assets", "project", "serve.mjs"), path.join(fixture, ".clone", "serve.mjs"));
  fs.writeFileSync(path.join(fixture, ".clone", "project.json"), JSON.stringify({
    mode: "full",
    paths: { runnableMirror: "site", evidence: ".clone/evidence", work: ".clone/work" },
    limits: { maxRecordingSeconds: 3, maxSingleFileMB: 10 },
    delivery: { labMountPath: "__lab" },
  }));
  fs.writeFileSync(path.join(fixture, "package.json"), JSON.stringify({
    private: true,
    scripts: { dev: "node .clone/serve.mjs" },
  }));
  fs.writeFileSync(path.join(fixture, "site", "index.html"), `<!doctype html>
    <style>@keyframes move{to{transform:translateX(180px)}}.dot{width:40px;height:40px;background:red;animation:move 1s linear infinite}</style>
    <div class="dot"></div>`);

  const result = spawnSync(process.execPath, [
    path.join(skill, "scripts", "record-motion.mjs"),
    "--project", fixture,
    "--name", "moving-dot",
    "--duration", "1",
    "--viewport", "640x480",
  ], { cwd: fixture, encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const video = path.join(fixture, ".clone", "work", "recordings", "moving-dot.mp4");
  const reportFile = `${video}.json`;
  assert.ok(fs.statSync(video).size > 1_000);
  const report = JSON.parse(fs.readFileSync(reportFile));
  assert.equal(report.format, "mp4");
  assert.equal(report.durationSeconds, 1);
  assert.equal(report.pageErrors.length, 0);

  const promoted = spawnSync(process.execPath, [
    path.join(skill, "scripts", "record-motion.mjs"),
    "--project", fixture,
    "--name", "moving-dot-web",
    "--duration", "1",
    "--settle", "0",
    "--viewport", "640x480",
    "--format", "webm",
    "--promote",
  ], { cwd: fixture, encoding: "utf8", timeout: 30_000 });
  assert.equal(promoted.status, 0, promoted.stderr || promoted.stdout);
  assert.ok(fs.statSync(path.join(fixture, "docs", "media", "moving-dot-web.webm")).size > 1_000);
  assert.ok(fs.existsSync(path.join(fixture, ".clone", "evidence", "recordings", "moving-dot-web.json")));
  console.log("record motion MP4, WebM, and promotion cases: OK");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
