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
  if (process.platform === "win32") {
    const script = path.join(root, "scripts", "install.ps1");
    const psArgs = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      ...toPowerShellArgs(args),
    ];
    run("powershell", psArgs);
    return;
  }

  run("bash", [path.join(root, "scripts", "install.sh"), ...args]);
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

function toPowerShellArgs(args) {
  return args.map((arg) => {
    if (arg === "--claude-only") return "-ClaudeOnly";
    if (arg === "--codex-only") return "-CodexOnly";
    if (arg === "--dry-run") return "-DryRun";
    return arg;
  });
}

function printHelp() {
  process.stdout.write(`claude-everything-workflow

Usage:
  cew install [--claude-only|--codex-only] [--dry-run]
  cew verify

Examples:
  npx claude-everything-workflow install
  npx claude-everything-workflow install --codex-only
  npx claude-everything-workflow verify
`);
}

main();
