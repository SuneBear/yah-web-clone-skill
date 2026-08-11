import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const skillRequire = createRequire(import.meta.url);
const projectRequire = createRequire(path.join(process.cwd(), "package.json"));
const bundledModuleDirs = [
  process.env.YAH_WEB_CLONE_NODE_MODULES || "",
  path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules"),
].filter(Boolean);

export function loadPlaywright() {
  const candidates = [
    () => projectRequire("playwright"),
    () => skillRequire("playwright"),
    ...bundledModuleDirs.map((moduleDir) => () => createRequire(path.join(moduleDir, "_yah-web-clone.cjs"))("playwright")),
  ];
  for (const load of candidates) {
    try {
      return load();
    } catch {
      // Try next candidate.
    }
  }
  throw new Error("Playwright not found. Install it in the project, set YAH_WEB_CLONE_NODE_MODULES, or install the Codex Browser runtime.");
}

export async function launchChromium(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch (firstError) {
    try {
      return await chromium.launch({ headless: true, channel: "chrome" });
    } catch {
      throw firstError;
    }
  }
}
