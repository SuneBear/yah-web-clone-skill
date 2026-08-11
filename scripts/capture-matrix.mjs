#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadPlaywright, launchChromium } from "./lib/playwright-loader.mjs";

function usage() {
  console.log(`Usage:
  node scripts/capture-matrix.mjs --url <base-url> --out <dir> [--label original] [--routes /,/about] [--widths 1440,768,390] [--states top,middle,bottom] [--wait 1000]

Captures a route × viewport × scroll-state screenshot matrix and writes matrix.json.
`);
}

function parseArgs(argv) {
  const out = {
    url: "",
    out: "",
    label: "site",
    routes: ["/"],
    widths: [1440, 768, 390],
    states: ["top", "middle", "bottom"],
    wait: 1000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--url") out.url = argv[++i] || "";
    else if (arg === "--out") out.out = argv[++i] || "";
    else if (arg === "--label") out.label = argv[++i] || "site";
    else if (arg === "--routes") out.routes = (argv[++i] || "/").split(",").map((value) => value.trim()).filter(Boolean);
    else if (arg === "--widths") out.widths = (argv[++i] || "").split(",").map(Number).filter((value) => value > 0);
    else if (arg === "--states") out.states = (argv[++i] || "").split(",").map((value) => value.trim()).filter(Boolean);
    else if (arg === "--wait") out.wait = Number(argv[++i] || "1000");
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function slug(input) {
  return input.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "home";
}

async function applyState(page, state) {
  await page.evaluate((name) => {
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const y = name === "bottom" ? max : name === "middle" ? max / 2 : 0;
    scrollTo(0, y);
  }, state);
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.url || !args.out) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  for (const state of args.states) {
    if (!["top", "middle", "bottom"].includes(state)) throw new Error(`Unsupported state: ${state}`);
  }
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await launchChromium(chromium);
  const captures = [];
  for (const route of args.routes) {
    const target = new URL(route, args.url).href;
    for (const width of args.widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      for (const state of args.states) {
        await applyState(page, state);
        if (args.wait > 0) await page.waitForTimeout(args.wait);
        const file = `${args.label}-${slug(route)}-${width}-${state}.png`;
        await page.screenshot({ path: path.join(outDir, file), fullPage: false });
        const metrics = await page.evaluate(() => ({
          href: location.href,
          title: document.title,
          scrollY,
          scrollHeight: document.documentElement.scrollHeight,
          canvas: document.querySelectorAll("canvas").length,
        }));
        captures.push({ route, target, width, state, file, metrics, errors: [...errors] });
      }
      await page.close();
    }
  }
  await browser.close();
  const manifest = path.join(outDir, `${args.label}-matrix.json`);
  fs.writeFileSync(manifest, `${JSON.stringify({
    label: args.label,
    baseUrl: args.url,
    capturedAt: new Date().toISOString(),
    captures,
  }, null, 2)}\n`);
  console.log(manifest);
} catch (error) {
  console.error(`capture-matrix failed: ${error.message}`);
  process.exit(1);
}
