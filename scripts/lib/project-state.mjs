import fs from "node:fs";
import path from "node:path";

export const PROJECT_STAGES = Object.freeze([
  "mirror",
  "capture",
  "effect_extract",
  "local_verify",
  "docs",
  "git_publish",
  "cloudflare_deploy",
  "production_verify",
]);

export const PROJECT_MODES = Object.freeze(["full", "mirror", "effect"]);

const LOCAL_STAGES = Object.freeze({
  full: ["mirror", "capture", "effect_extract", "local_verify", "docs"],
  mirror: ["mirror", "local_verify"],
  effect: ["capture", "effect_extract", "local_verify", "docs"],
});

function normalizePublishTargets(input) {
  const values = Array.isArray(input)
    ? input
    : String(input || "").split(",");
  return [...new Set(values.map((value) => value.trim()).filter((value) => ["github", "cloudflare"].includes(value)))];
}

export function stagesForMode(mode, publishTargets = []) {
  if (!PROJECT_MODES.includes(mode)) {
    throw new Error(`Unknown mode "${mode}". Expected one of: ${PROJECT_MODES.join(", ")}`);
  }
  const stages = [...LOCAL_STAGES[mode]];
  const targets = normalizePublishTargets(publishTargets);
  if (targets.includes("github")) stages.push("git_publish");
  if (targets.includes("cloudflare")) stages.push("cloudflare_deploy", "production_verify");
  return stages;
}

export function stateFile(project) {
  const root = path.resolve(project);
  const modern = path.join(root, ".clone", "project.json");
  const legacy = path.join(root, "PROJECT_STATE.json");
  return fs.existsSync(legacy) && !fs.existsSync(modern) ? legacy : modern;
}

export function finalConfigFile(project) {
  return path.join(path.resolve(project), "clone.config.json");
}

export function readProjectConfig(project) {
  const processFile = stateFile(project);
  const finalFile = finalConfigFile(project);
  const file = fs.existsSync(processFile) ? processFile : finalFile;
  if (!fs.existsSync(file)) {
    throw new Error(`Missing project config: expected ${processFile} or ${finalFile}`);
  }
  return {
    file,
    finalized: path.resolve(file) === path.resolve(finalFile),
    config: JSON.parse(fs.readFileSync(file, "utf8")),
  };
}

export function createProjectState({
  project,
  name,
  url = "",
  mode = "full",
  effect = "",
  authorization = "unknown",
  publishTargets = [],
  config = {},
}) {
  const now = new Date().toISOString();
  const targets = normalizePublishTargets(publishTargets);
  const requiredStages = stagesForMode(mode, targets);
  return {
    schemaVersion: 3,
    skill: "yah-web-clone",
    skillVersion: "3.3",
    project: path.resolve(project),
    name,
    url,
    mode,
    effect,
    authorization,
    paths: {
      ...(mode !== "effect" ? { runnableMirror: "site" } : {}),
      ...(mode !== "mirror" ? { runnableLab: "lab", humanDocs: "docs" } : {}),
      evidence: ".clone/evidence",
      work: ".clone/work",
      archive: ".clone/archive",
    },
    contract: {
      runnableFromRoot: true,
      humanLanguage: config.docsLanguage || "zh-CN",
      preserveSourceContentLanguage: true,
      fidelity: mode === "effect" ? "effect-baseline" : "site-1-to-1",
      analysis: mode === "full" || mode === "effect",
      keyScreenshots: mode === "full" || mode === "effect",
      motionRecording: "optional-low-priority",
      gui: mode === "full" || mode === "effect" ? "dialkit-if-useful" : "none",
      presets: mode === "full" || mode === "effect" ? "required-for-tunable-effects" : "none",
    },
    limits: {
      maxProjectSizeMB: Number(config.maxProjectSizeMB) || 250,
      maxSingleFileMB: Number(config.maxSingleFileMB) || 25,
      maxRecordingSeconds: Number(config.maxRecordingSeconds) || 12,
    },
    delivery: {
      githubOrg: config.githubOrg || "",
      repoVisibility: config.repoVisibility || "private",
      docsLanguage: config.docsLanguage || "zh-CN",
      publishMode: config.publishMode || "direct-main",
      deploymentProvider: config.deploymentProvider || "cloudflare-pages",
      publishTargets: targets,
      publishLayout: mode === "full" ? "site-with-lab" : mode === "effect" ? "lab" : "site",
      labMountPath: config.labMountPath || "__lab",
      labBuildCommand: config.labBuildCommand || "",
      labOutputDir: config.labOutputDir || "",
    },
    requiredStages,
    stages: Object.fromEntries(PROJECT_STAGES.map((id) => [id, {
      status: requiredStages.includes(id) ? "pending" : "skipped",
      updatedAt: now,
      note: requiredStages.includes(id) ? "" : "not required by project mode",
    }])),
    createdAt: now,
    updatedAt: now,
  };
}

export function readProjectState(project) {
  const file = stateFile(project);
  if (!fs.existsSync(file)) throw new Error(`Missing project state: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeProjectState(project, state) {
  const file = stateFile(project);
  const next = { ...state, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  return file;
}

export function updateProjectStage(project, stage, status, note = "") {
  const normalizedStage = { recon: "capture", study_source: "effect_extract" }[stage] || stage;
  if (!PROJECT_STAGES.includes(normalizedStage)) {
    throw new Error(`Unknown stage "${stage}". Expected one of: ${PROJECT_STAGES.join(", ")}`);
  }
  if (!["pending", "in_progress", "completed", "blocked", "skipped"].includes(status)) {
    throw new Error(`Invalid status "${status}".`);
  }
  const state = readProjectState(project);
  state.stages[normalizedStage] = {
    status,
    updatedAt: new Date().toISOString(),
    note,
  };
  writeProjectState(project, state);
  return state;
}
