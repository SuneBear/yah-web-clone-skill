#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function usage() {
  console.log(`Usage:
  node scripts/prepare-deploy.mjs [options]

Options:
  --project <dir>       Project root; defaults to the parent of the script directory
  --out <dir>           Composite output (process default: .clone/work/publish; final: dist)
  --lab-command <cmd>   Command that builds the Lab
  --lab-output <dir>    Lab build output relative to project root
  --skip-lab-build      Use the configured/static Lab output without running a build

Layout:
  full    site/ -> / and Lab output -> /__lab/
  mirror  site/ -> /
  effect  Lab output -> /
  collection  cases/ -> / and optional Lab output -> /__lab/
`);
}

function parseArgs(argv) {
  const out = { project: "", output: "", labCommand: "", labOutput: "", skipLabBuild: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--project") out.project = argv[++i] || "";
    else if (arg === "--out") out.output = argv[++i] || "";
    else if (arg === "--lab-command") out.labCommand = argv[++i] || "";
    else if (arg === "--lab-output") out.labOutput = argv[++i] || "";
    else if (arg === "--skip-lab-build") out.skipLabBuild = true;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return out;
}

function readJson(file, fallback = {}) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

function inside(root, candidate) {
  const boundary = `${path.resolve(root)}${path.sep}`;
  const resolved = path.resolve(candidate);
  return resolved === path.resolve(root) || resolved.startsWith(boundary);
}

function resolveProjectPath(project, input, label) {
  const resolved = path.resolve(project, input);
  if (!inside(project, resolved) || resolved === project) {
    throw new Error(`${label} must be a directory inside the project: ${input}`);
  }
  return resolved;
}

const ignoredNames = new Set([
  ".DS_Store",
  ".git",
  ".clone",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".wrangler",
  "node_modules",
]);

function copySurface(source, target) {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error(`Missing publish surface: ${source}`);
  }
  fs.cpSync(source, target, {
    recursive: true,
    filter: (entry) => !ignoredNames.has(path.basename(entry)),
  });
}

function countFiles(root) {
  if (!fs.existsSync(root)) return 0;
  return fs.readdirSync(root, { withFileTypes: true }).reduce((sum, entry) => {
    const file = path.join(root, entry.name);
    return sum + (entry.isDirectory() ? countFiles(file) : 1);
  }, 0);
}

function normalizeMount(input) {
  const value = String(input || "__lab").replace(/^\/+|\/+$/g, "");
  if (!value || value.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`Invalid Lab mount path: ${input}`);
  }
  return value;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const localScriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultProject = path.dirname(localScriptDir);
  const project = path.resolve(args.project || defaultProject);
  const processStateFile = path.join(project, ".clone", "project.json");
  const finalConfigFile = path.join(project, "clone.config.json");
  const stateFile = fs.existsSync(processStateFile) ? processStateFile : finalConfigFile;
  const state = readJson(stateFile, null);
  if (!state) throw new Error(`Missing project config: ${processStateFile} or ${finalConfigFile}`);
  const finalized = path.resolve(stateFile) === path.resolve(finalConfigFile);

  const workRoot = finalized ? null : path.join(project, ".clone", "work");
  const defaultOutput = finalized ? (state.paths?.publishOutput || "dist") : ".clone/work/publish";
  const output = resolveProjectPath(project, args.output || defaultOutput, "--out");
  if (finalized && output !== resolveProjectPath(project, defaultOutput, "publish output")) {
    throw new Error(`--out must match clone.config.json paths.publishOutput (${defaultOutput}).`);
  }
  if (!finalized && !inside(workRoot, output)) {
    throw new Error("--out must stay inside .clone/work so it can be replaced safely.");
  }

  const packageJson = readJson(path.join(project, "package.json"));
  const configuredCommand = String(state.delivery?.labBuildCommand || "").trim();
  const autoCommand = packageJson.scripts?.["build:lab"] ? "npm run build:lab" : "";
  const candidateLabCommand = args.skipLabBuild ? "" : (args.labCommand || configuredCommand || autoCommand);
  const configuredOutput = String(state.delivery?.labOutputDir || "").trim();
  const defaultLabOutput = candidateLabCommand ? "lab/dist" : (state.paths?.runnableLab || "lab");
  const labOutput = args.labOutput || configuredOutput || defaultLabOutput;
  const labMount = normalizeMount(state.delivery?.labMountPath || "__lab");
  const staticLab = path.resolve(project, state.paths?.runnableLab || "lab");
  const configuredLab = path.resolve(project, labOutput);
  const collectionHasLab = state.mode === "collection"
    && (Boolean(candidateLabCommand) || fs.existsSync(path.join(configuredLab, "index.html")) || fs.existsSync(path.join(staticLab, "index.html")));
  const hasLab = ["full", "effect"].includes(state.mode) || collectionHasLab;
  const labCommand = hasLab ? candidateLabCommand : "";

  if (labCommand) {
    console.log(`Building Lab: ${labCommand}`);
    const result = spawnSync(labCommand, { cwd: project, shell: true, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Lab build failed with exit code ${result.status}.`);
  }

  const primarySource = state.mode === "effect"
    ? null
    : state.mode === "collection"
      ? resolveProjectPath(project, state.paths?.runnableCollection || "cases", "collection source")
      : resolveProjectPath(project, state.paths?.runnableMirror || "site", "site source");
  const labSource = hasLab
    ? resolveProjectPath(project, labOutput, "Lab output")
    : null;
  if (labSource && !fs.existsSync(path.join(labSource, "index.html"))) {
    throw new Error(`Lab output has no index.html: ${labSource}. Configure delivery.labOutputDir or --lab-output.`);
  }

  if (workRoot) fs.mkdirSync(workRoot, { recursive: true });
  if (fs.existsSync(output)) fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });

  const surfaces = [];
  if (state.mode === "effect") {
    copySurface(labSource, output);
    surfaces.push({ route: "/", source: path.relative(project, labSource) });
  } else {
    copySurface(primarySource, output);
    surfaces.push({ route: "/", source: path.relative(project, primarySource) });
    if (["full", "collection"].includes(state.mode) && labSource) {
      const labTarget = path.join(output, labMount);
      if (fs.existsSync(labTarget)) throw new Error(`Site already contains the Lab mount path: /${labMount}/`);
      copySurface(labSource, labTarget);
      surfaces.push({ route: `/${labMount}/`, source: path.relative(project, labSource) });
    }
  }

  const manifest = {
    schemaVersion: 1,
    preparedAt: new Date().toISOString(),
    mode: state.mode,
    output: path.relative(project, output),
    surfaces,
    lab: !labSource ? null : {
      buildCommand: labCommand || null,
      output: path.relative(project, labSource),
      mountPath: state.mode === "effect" ? "/" : `/${labMount}/`,
    },
    fileCount: countFiles(output),
  };
  const manifestFile = finalized
    ? path.join(project, state.paths?.publishManifest || "dist.manifest.json")
    : path.join(workRoot, "publish-manifest.json");
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Publish directory: ${output}`);
  console.log(`Manifest: ${manifestFile}`);
  console.log(`Files: ${manifest.fileCount}`);
} catch (error) {
  console.error(`prepare-deploy failed: ${error.message}`);
  process.exit(1);
}
