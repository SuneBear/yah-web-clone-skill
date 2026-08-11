#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { readProjectConfig } from "./lib/project-state.mjs";
import { launchChromium, loadPlaywright } from "./lib/playwright-loader.mjs";

function usage() {
  console.log(`Usage:
  node scripts/record-motion.mjs --project <dir> --name <slug> [options]

Options:
  --surface <site|lab|cases> Local surface to record (default follows mode)
  --route <path>             Route within the surface (default: /)
  --url <url>                Record an external URL instead of starting the project
  --duration <seconds>       Motion duration (default: 6; capped by project config)
  --settle <seconds>         Wait after load before the kept clip begins (default: 3)
  --ready-selector <css>     Wait for a visible readiness element before settling
  --wait-hidden <css>        Wait for a loading overlay to become hidden
  --viewport <width>x<height> (default: 1440x900)
  --action <none|scroll|hover|click|drag>
  --selector <css>           Required for hover, click, and drag
  --dx <pixels> --dy <pixels> Drag offset (default: 120, 0)
  --format <mp4|webm>        Final format (default: mp4)
  --promote                  Put the clip in docs/media and evidence in the durable evidence directory
  --out <relative-file>      Explicit project-relative output path

Without --promote, process-stage recordings stay in .clone/work/recordings/.
Finalized projects require --promote or --out.`);
}

function parseArgs(argv) {
  const out = {
    project: "",
    name: "",
    surface: "",
    route: "/",
    url: "",
    duration: 6,
    settle: 3,
    readySelector: "",
    waitHidden: "",
    viewport: "1440x900",
    action: "none",
    selector: "",
    dx: 120,
    dy: 0,
    format: "mp4",
    promote: false,
    output: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--name") out.name = argv[++i] || "";
    else if (arg === "--surface") out.surface = argv[++i] || "";
    else if (arg === "--route") out.route = argv[++i] || "/";
    else if (arg === "--url") out.url = argv[++i] || "";
    else if (arg === "--duration") out.duration = Number(argv[++i] || 0);
    else if (arg === "--settle") out.settle = Number(argv[++i] || 0);
    else if (arg === "--ready-selector") out.readySelector = argv[++i] || "";
    else if (arg === "--wait-hidden") out.waitHidden = argv[++i] || "";
    else if (arg === "--viewport") out.viewport = argv[++i] || "";
    else if (arg === "--action") out.action = argv[++i] || "";
    else if (arg === "--selector") out.selector = argv[++i] || "";
    else if (arg === "--dx") out.dx = Number(argv[++i] || 0);
    else if (arg === "--dy") out.dy = Number(argv[++i] || 0);
    else if (arg === "--format") out.format = argv[++i] || "";
    else if (arg === "--promote") out.promote = true;
    else if (arg === "--out") out.output = argv[++i] || "";
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function parseViewport(input) {
  const match = String(input).match(/^(\d+)x(\d+)$/i);
  if (!match) throw new Error("--viewport must look like 1440x900");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 240 || height < 240 || width > 7680 || height > 4320) throw new Error("Viewport is outside the supported range.");
  return { width: width - (width % 2), height: height - (height % 2) };
}

function safeName(input) {
  const value = String(input).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!value) throw new Error("--name must contain letters or numbers.");
  return value;
}

function inside(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  return resolved.startsWith(`${resolvedRoot}${path.sep}`);
}

function resolveOutput(project, relative) {
  const output = path.resolve(project, relative);
  if (!inside(project, output)) throw new Error(`Recording output must stay inside the project: ${relative}`);
  return output;
}

function localRoute(config, surface, input) {
  const route = `/${String(input || "/").replace(/^\/+/, "")}`;
  if (surface !== "lab" || config.mode === "effect") return route;
  const mount = String(config.delivery?.labMountPath || "__lab").replace(/^\/+|\/+$/g, "");
  if (route === `/${mount}` || route.startsWith(`/${mount}/`)) return route;
  return `/${mount}${route}`;
}

function collectionLabExists(project, config) {
  const packageFile = path.join(project, "package.json");
  const pkg = fs.existsSync(packageFile) ? JSON.parse(fs.readFileSync(packageFile, "utf8")) : {};
  const hasBuild = Boolean(config.delivery?.labBuildCommand || pkg.scripts?.["build:lab"]);
  const root = config.delivery?.labOutputDir || (hasBuild ? "lab/dist" : config.paths?.runnableLab || "lab");
  return fs.existsSync(path.join(project, root, "index.html"));
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Local preview exited with code ${child.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The preview may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for local preview: ${url}`);
}

async function performAction(page, args, durationMs) {
  if (["hover", "click", "drag"].includes(args.action) && !args.selector) {
    throw new Error(`--selector is required for --action ${args.action}`);
  }
  if (args.action === "scroll") {
    await page.evaluate(async (duration) => {
      await new Promise((resolve) => {
        const start = performance.now();
        const distance = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        const tick = (now) => {
          const progress = Math.min(1, (now - start) / duration);
          scrollTo(0, distance * (0.5 - Math.cos(Math.PI * progress) / 2));
          if (progress < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
    }, durationMs);
    return;
  }
  if (args.action === "hover") await page.hover(args.selector);
  else if (args.action === "click") await page.click(args.selector);
  else if (args.action === "drag") {
    const box = await page.locator(args.selector).boundingBox();
    if (!box) throw new Error(`Cannot drag invisible selector: ${args.selector}`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + args.dx, y + args.dy, { steps: Math.max(8, Math.round(durationMs / 100)) });
    await page.mouse.up();
  }
  await page.waitForTimeout(durationMs);
}

function encode(rawFile, encodedFile, format, trimStart, duration) {
  const codec = format === "mp4"
    ? ["-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
    : ["-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1"];
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", rawFile,
    "-ss", trimStart.toFixed(3), "-t", duration.toFixed(3), "-an", ...codec, encodedFile,
  ], { encoding: "utf8" });
  if (result.error?.code === "ENOENT") throw new Error("Recording output requires ffmpeg for trimming and encoding.");
  if (result.status !== 0) throw new Error(result.stderr.trim() || `ffmpeg exited with ${result.status}`);
}

let server = null;
let browser = null;
let temporary = "";
try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project || !args.name) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  if (!Number.isFinite(args.duration) || args.duration <= 0) throw new Error("--duration must be a positive number.");
  if (!Number.isFinite(args.settle) || args.settle < 0 || args.settle > 30) throw new Error("--settle must be between 0 and 30 seconds.");
  if (!["mp4", "webm"].includes(args.format)) throw new Error("--format must be mp4 or webm.");
  if (!["none", "scroll", "hover", "click", "drag"].includes(args.action)) throw new Error("Unsupported --action.");
  if (args.surface && !["site", "lab", "cases"].includes(args.surface)) throw new Error("--surface must be site, lab, or cases.");

  const project = path.resolve(args.project);
  const { config, finalized } = readProjectConfig(project);
  const maxSeconds = Number(config.limits?.maxRecordingSeconds || 12);
  if (args.duration > maxSeconds) throw new Error(`Recording exceeds maxRecordingSeconds (${maxSeconds}).`);
  const viewport = parseViewport(args.viewport);
  const name = safeName(args.name);
  const surface = args.surface || (config.mode === "effect" ? "lab" : config.mode === "collection" ? "cases" : "site");
  if (surface === "site" && ["effect", "collection"].includes(config.mode)) throw new Error(`${config.mode} mode has no site surface.`);
  if (surface === "cases" && config.mode !== "collection") throw new Error("Only collection mode has a cases surface.");
  if (surface === "lab" && config.mode === "mirror") throw new Error("mirror mode has no Lab surface.");
  if (surface === "lab" && config.mode === "collection" && !collectionLabExists(project, config)) {
    throw new Error("collection mode has no built Lab yet. Run build:lab first when applicable.");
  }

  let targetUrl = args.url;
  if (targetUrl) {
    targetUrl = new URL(targetUrl).href;
  } else {
    const port = 43000 + (process.pid % 1000);
    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    server = spawn(command, ["run", "dev", "--", "--port", String(port)], {
      cwd: project,
      stdio: ["ignore", "pipe", "pipe"],
    });
    targetUrl = `http://127.0.0.1:${port}${localRoute(config, surface, args.route)}`;
    await waitForServer(targetUrl, server);
  }
  console.log(`Opening: ${targetUrl}`);

  const extension = args.format;
  let relativeOutput = args.output;
  if (!relativeOutput) {
    if (args.promote) relativeOutput = `docs/media/${name}.${extension}`;
    else if (!finalized) relativeOutput = `.clone/work/recordings/${name}.${extension}`;
    else throw new Error("Finalized projects require --promote or --out for recordings.");
  }
  if (path.extname(relativeOutput).toLowerCase() !== `.${extension}`) {
    throw new Error(`--out extension must match --format ${extension}.`);
  }
  const output = resolveOutput(project, relativeOutput);
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite existing recording: ${output}`);

  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "yah-record-motion-"));
  const rawFile = path.join(temporary, "raw.webm");
  const encodedFile = path.join(temporary, `encoded.${extension}`);
  const playwright = loadPlaywright();
  browser = await launchChromium(playwright.chromium);
  const context = await browser.newContext({ viewport, recordVideo: { dir: temporary, size: viewport } });
  const recordingStartedAt = performance.now();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log("Waiting for page readiness...");
  await page.waitForLoadState("load", { timeout: 30_000 });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  if (args.readySelector) await page.locator(args.readySelector).first().waitFor({ state: "visible", timeout: 30_000 });
  const hiddenSelectors = args.waitHidden
    ? [args.waitHidden]
    : await page.evaluate(() => ["#loader", "[data-loader]", "[data-loading='true']", "[aria-busy='true']"].filter((selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
    }));
  for (const selector of hiddenSelectors) {
    await page.waitForFunction((value) => {
      const element = document.querySelector(value);
      if (!element) return true;
      const style = getComputedStyle(element);
      return style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0.01 || style.pointerEvents === "none";
    }, selector, { timeout: 30_000 });
  }
  await page.waitForTimeout(Math.round(args.settle * 1000));
  console.log(`Page ready. Recording ${args.duration}s after ${args.settle}s settle time.`);
  const video = page.video();
  const trimStart = (performance.now() - recordingStartedAt) / 1000;
  await performAction(page, args, Math.round(args.duration * 1000));
  await context.close();
  await video.saveAs(rawFile);
  console.log(`Encoding ${args.format.toUpperCase()} and trimming loading preroll...`);
  encode(rawFile, encodedFile, args.format, trimStart, args.duration);

  const bytes = fs.statSync(encodedFile).size;
  const maxFileMB = Number(config.limits?.maxSingleFileMB || 25);
  if (maxFileMB > 0 && bytes > maxFileMB * 1024 ** 2) {
    throw new Error(`Recording is ${(bytes / 1024 ** 2).toFixed(1)} MB, above the ${maxFileMB} MB single-file limit.`);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(encodedFile, output);

  const report = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    sourceUrl: targetUrl,
    surface,
    route: args.route,
    action: args.action,
    selector: args.selector || null,
    durationSeconds: args.duration,
    settleSeconds: args.settle,
    trimStartSeconds: Number(trimStart.toFixed(3)),
    readySelector: args.readySelector || null,
    waitHidden: hiddenSelectors,
    viewport,
    format: args.format,
    output: path.relative(project, output),
    bytes,
    consoleErrors,
    pageErrors,
  };
  const reportFile = args.promote
    ? path.resolve(project, config.paths?.evidence || ".clone/evidence", "recordings", `${name}.json`)
    : `${output}.json`;
  if (!inside(project, reportFile)) throw new Error("Recording report must stay inside the project.");
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Recording: ${output}`);
  console.log(`Evidence:  ${reportFile}`);
  console.log(`Format: ${args.format.toUpperCase()}, ${(bytes / 1024 ** 2).toFixed(1)} MB, ${args.duration}s`);
  if (consoleErrors.length || pageErrors.length) {
    console.log(`Warnings: ${consoleErrors.length} console errors, ${pageErrors.length} page errors`);
  }
} catch (error) {
  console.error(`record-motion failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server && server.exitCode === null) server.kill("SIGTERM");
  if (temporary && fs.existsSync(temporary)) fs.rmSync(temporary, { recursive: true, force: true });
}
