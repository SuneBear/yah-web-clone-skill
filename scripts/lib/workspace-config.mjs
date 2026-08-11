import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT_ENV = "YAH_WEB_CLONE_ROOT";
const CONFIG_ENV = "YAH_WEB_CLONE_CONFIG";

export const DEFAULT_CONFIG = Object.freeze({
  workspaceRoot: "",
  githubOrg: "",
  repoVisibility: "private",
  docsLanguage: "zh-CN",
  publishMode: "direct-main",
  deploymentProvider: "cloudflare-pages",
  archiveStrategy: "clone-directory",
  defaultMode: "full",
  publishTargets: [],
  maxProjectSizeMB: 250,
  maxSingleFileMB: 25,
  maxRecordingSeconds: 12,
  viewports: [1440, 768, 390],
  labBuildCommand: "",
  labOutputDir: "",
  labMountPath: "__lab",
});

function expandHome(input) {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

function normalizeRoot(input) {
  const value = String(input || "").trim();
  return value ? path.resolve(expandHome(value)) : "";
}

export function workspaceConfigPath() {
  const override = normalizeRoot(process.env[CONFIG_ENV]);
  return override || path.join(os.homedir(), ".config", "yah-web-clone", "config.json");
}

function readUserConfig() {
  const configPath = workspaceConfigPath();
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid Yah Web Clone config at ${configPath}: ${error.message}`);
  }
}

export function resolveWorkspaceRoot({ override = "", config = null } = {}) {
  return normalizeRoot(override)
    || normalizeRoot(process.env[ROOT_ENV])
    || normalizeRoot((config || readUserConfig()).workspaceRoot)
    || process.cwd();
}

export function loadYahConfig({ overrideRoot = "" } = {}) {
  const userConfig = readUserConfig();
  const config = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };
  config.workspaceRoot = resolveWorkspaceRoot({ override: overrideRoot, config: userConfig });
  config.viewports = Array.isArray(config.viewports)
    ? config.viewports.map(Number).filter((value) => Number.isFinite(value) && value > 0)
    : [...DEFAULT_CONFIG.viewports];
  config.publishTargets = Array.isArray(config.publishTargets)
    ? config.publishTargets.filter((value) => ["github", "cloudflare"].includes(value))
    : [];
  return config;
}
