#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const project = path.dirname(scriptDir);
const processStateFile = path.join(project, ".clone", "project.json");
const finalConfigFile = path.join(project, "clone.config.json");
const configFile = fs.existsSync(processStateFile) ? processStateFile : finalConfigFile;
if (!fs.existsSync(configFile)) {
  throw new Error(`Missing project config: ${processStateFile} or ${finalConfigFile}`);
}
const state = JSON.parse(fs.readFileSync(configFile, "utf8"));
const packageFile = path.join(project, "package.json");
const packageJson = fs.existsSync(packageFile) ? JSON.parse(fs.readFileSync(packageFile, "utf8")) : {};
const labBuildCommand = String(state.delivery?.labBuildCommand || "").trim() || (packageJson.scripts?.["build:lab"] ? "npm run build:lab" : "");
const labPreviewRoot = String(state.delivery?.labOutputDir || "").trim()
  || (labBuildCommand ? "lab/dist" : state.paths?.runnableLab || "lab");

function parseArgs(argv) {
  const out = { surface: "", port: 4173, host: "127.0.0.1" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--surface") out.surface = argv[++i] || "";
    else if (arg === "--port") out.port = Number(argv[++i] || 4173);
    else if (arg === "--host") out.host = argv[++i] || out.host;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if (out.surface && !["site", "lab", "cases"].includes(out.surface)) {
    throw new Error("--surface must be site, lab, or cases");
  }
  if (!Number.isInteger(out.port) || out.port < 1 || out.port > 65535) {
    throw new Error("--port must be between 1 and 65535");
  }
  return out;
}

const mime = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safeFile(root, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath.split("?")[0]);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "");
  const candidate = path.resolve(root, relative || "index.html");
  const boundary = `${path.resolve(root)}${path.sep}`;
  if (candidate !== path.resolve(root) && !candidate.startsWith(boundary)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return path.join(candidate, "index.html");
  }
  return candidate;
}

function placeholder(surface) {
  return Buffer.from(`<!doctype html><meta charset="utf-8"><title>Yah Web Clone</title>
<style>body{font:16px/1.6 ui-monospace,monospace;max-width:720px;margin:15vh auto;padding:0 24px;background:#111;color:#eee}code{color:#a8d5a2}</style>
<h1>${surface} 尚未生成</h1><p>项目脚手架已可运行。完成当前流水线阶段后刷新此页面。</p>`);
}

function sendFile(response, file, surface) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    if (path.basename(file || "") === "index.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(placeholder(surface));
      return;
    }
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "content-type": mime[path.extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(response);
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("node scripts/serve.mjs [--surface site|lab|cases] [--port 4173] [--host 127.0.0.1]");
    process.exit(0);
  }
  const defaultSurface = args.surface || (state.mode === "effect" ? "lab" : state.mode === "collection" ? "cases" : "site");
  const surfaceRoots = {
    site: state.paths?.runnableMirror || "site",
    lab: labPreviewRoot,
    cases: state.paths?.runnableCollection || "cases",
  };
  const server = http.createServer((request, response) => {
    const incoming = request.url || "/";
    const useLabRoute = !args.surface && incoming.startsWith("/__lab");
    const surface = useLabRoute ? "lab" : defaultSurface;
    const requestPath = useLabRoute ? incoming.replace(/^\/__lab(?=\/|$)/, "") || "/" : incoming;
    const root = path.join(project, surfaceRoots[surface]);
    const file = safeFile(root, requestPath);
    sendFile(response, file, surface);
  });
  server.listen(args.port, args.host, () => {
    console.log(`Yah Web Clone · ${state.mode}`);
    console.log(`Preview: http://${args.host}:${args.port}/`);
    const hasLab = fs.existsSync(path.join(project, surfaceRoots.lab, "index.html"));
    if (!args.surface && ["full", "collection"].includes(state.mode) && hasLab) {
      console.log(`Lab:     http://${args.host}:${args.port}/__lab/`);
    }
  });
} catch (error) {
  console.error(`preview failed: ${error.message}`);
  process.exit(1);
}
