#!/usr/bin/env node
import { resolveWorkspaceRoot, workspaceConfigPath } from "./lib/workspace-config.mjs";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage:
  node scripts/workspace-root.mjs

Resolution order:
  1. YAH_WEB_CLONE_ROOT
  2. YAH_WEB_CLONE_CONFIG or ~/.config/yah-web-clone/config.json
  3. Current working directory

Default config:
  ${workspaceConfigPath()}
`);
  process.exit(0);
}

console.log(resolveWorkspaceRoot());
