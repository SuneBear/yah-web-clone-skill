#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skill = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "yah-prepare-deploy-"));

try {
  fs.mkdirSync(path.join(fixture, ".clone"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "site"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "lab"), { recursive: true });
  fs.writeFileSync(path.join(fixture, "site", "index.html"), "<h1>Site</h1>");
  fs.writeFileSync(path.join(fixture, "lab", "source.txt"), "not published");
  fs.writeFileSync(path.join(fixture, "build-lab.mjs"), `
    import fs from "node:fs";
    fs.mkdirSync("lab/dist/assets", { recursive: true });
    fs.writeFileSync("lab/dist/index.html", '<script src="./assets/app.js"></script>');
    fs.writeFileSync("lab/dist/assets/app.js", "console.log('lab')");
  `);
  fs.writeFileSync(path.join(fixture, "package.json"), JSON.stringify({
    private: true,
    scripts: { "build:lab": "node build-lab.mjs" },
  }));
  fs.writeFileSync(path.join(fixture, ".clone", "project.json"), JSON.stringify({
    mode: "full",
    paths: { runnableMirror: "site", runnableLab: "lab", work: ".clone/work" },
    delivery: { publishLayout: "site-with-lab", labMountPath: "__lab" },
  }));
  fs.copyFileSync(
    path.join(skill, "assets", "project", "prepare-deploy.mjs"),
    path.join(fixture, ".clone", "prepare-deploy.mjs")
  );

  const result = spawnSync(process.execPath, [path.join(fixture, ".clone", "prepare-deploy.mjs")], {
    cwd: fixture,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(fs.existsSync(path.join(fixture, ".clone", "work", "publish", "index.html")));
  assert.ok(fs.existsSync(path.join(fixture, ".clone", "work", "publish", "__lab", "index.html")));
  assert.ok(fs.existsSync(path.join(fixture, ".clone", "work", "publish", "__lab", "assets", "app.js")));
  assert.ok(!fs.existsSync(path.join(fixture, ".clone", "work", "publish", "__lab", "source.txt")));
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture, ".clone", "work", "publish-manifest.json")));
  assert.equal(manifest.lab.buildCommand, "npm run build:lab");
  assert.equal(manifest.lab.output, "lab/dist");
  assert.equal(manifest.lab.mountPath, "/__lab/");

  const collection = path.join(fixture, "collection");
  fs.mkdirSync(path.join(collection, ".clone", "work"), { recursive: true });
  fs.mkdirSync(path.join(collection, "cases"), { recursive: true });
  fs.mkdirSync(path.join(collection, "lab"), { recursive: true });
  fs.writeFileSync(path.join(collection, "cases", "index.html"), "<h1>Collection</h1>");
  fs.writeFileSync(path.join(collection, "lab", "experiment.ts"), "document.body.dataset.ready = 'true';\n");
  fs.writeFileSync(path.join(collection, "build-lab.mjs"), `
    import fs from "node:fs";
    fs.mkdirSync("lab/dist", { recursive: true });
    fs.writeFileSync("lab/dist/index.html", '<script src="./app.js"></script>');
    fs.writeFileSync("lab/dist/app.js", "console.log('collection lab')");
  `);
  fs.writeFileSync(path.join(collection, "package.json"), JSON.stringify({
    private: true,
    scripts: { "build:lab": "node build-lab.mjs" },
  }));
  fs.writeFileSync(path.join(collection, ".clone", "project.json"), JSON.stringify({
    mode: "collection",
    paths: { runnableCollection: "cases", runnableLab: "lab", work: ".clone/work" },
    delivery: { publishLayout: "collection-with-optional-lab", labMountPath: "__lab" },
  }));
  fs.copyFileSync(
    path.join(skill, "assets", "project", "prepare-deploy.mjs"),
    path.join(collection, ".clone", "prepare-deploy.mjs")
  );
  const collectionResult = spawnSync(process.execPath, [path.join(collection, ".clone", "prepare-deploy.mjs")], {
    cwd: collection,
    encoding: "utf8",
  });
  assert.equal(collectionResult.status, 0, collectionResult.stderr || collectionResult.stdout);
  assert.match(fs.readFileSync(path.join(collection, ".clone", "work", "publish", "index.html"), "utf8"), /Collection/);
  assert.ok(fs.existsSync(path.join(collection, ".clone", "work", "publish", "__lab", "app.js")));
  console.log("prepare-deploy build case: OK");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
