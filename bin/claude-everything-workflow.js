#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (command === "install" || command === "doctor") {
    runNodeScript("scripts/install-manager.js", [command, ...args]);
    return;
  }

  if (command === "verify") {
    runNodeScript("scripts/verify-harness.js", args);
    return;
  }

  process.stderr.write(`未知命令：${command}\n\n`);
  printHelp();
  process.exit(1);
}

function runNodeScript(relativeScript, args) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, relativeScript), ...args],
    { cwd: root, stdio: "inherit" },
  );

  if (result.error) {
    process.stderr.write(`${relativeScript} 执行失败：${result.error.message}\n`);
    process.exit(1);
  }

  process.exit(typeof result.status === "number" ? result.status : 1);
}

function printHelp() {
  process.stdout.write(`claude-everything-workflow

用法：
  cew install [--claude-only|--codex-only] [--profile core|coding|full] [--dry-run]
  cew doctor [--claude-only|--codex-only]
  cew verify

示例：
  npx claude-everything-workflow install
  npx claude-everything-workflow install --profile coding --codex-only
  npx claude-everything-workflow doctor
  npx claude-everything-workflow verify
`);
}

main();
