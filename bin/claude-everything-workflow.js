#!/usr/bin/env node
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");

function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (command === "install") {
    runInstall(args);
    return;
  }

  if (command === "verify") {
    runNodeScript("scripts/verify-harness.js", args);
    return;
  }

  process.stderr.write(`Unknown command: ${command}\n\n`);
  printHelp();
  process.exit(1);
}

function runInstall(args) {
  runNodeScript("scripts/install-host.js", args);
}

function runNodeScript(relativeScript, args) {
  run(process.execPath, [path.join(root, relativeScript), ...args]);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.error) {
    process.stderr.write(`${command} failed: ${result.error.message}\n`);
    process.exit(1);
  }

  process.exit(typeof result.status === "number" ? result.status : 1);
}

function printHelp() {
  process.stdout.write(`claude-everything-workflow

Usage:
  cew install [--claude-only|--codex-only] [--home DIR] [--with-skill NAME] [--dry-run]
  cew verify

Examples:
  npx claude-everything-workflow install
  npx claude-everything-workflow install --codex-only
  npx claude-everything-workflow verify
`);
}

main();
