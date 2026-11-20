#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SERVER_NAME = "chrome-devtools";
const MIN_NODE = [20, 19, 0];
const COMMAND = [
  "mcp", "add", "-s", "user", SERVER_NAME, "--",
  "npx", "-y", "chrome-devtools-mcp@latest",
  "--autoConnect", "--no-usage-statistics", "--no-performance-crux",
];

function claudeConfigPath() {
  return path.join(process.env.HOME || os.homedir(), ".claude.json");
}

function hasServer() {
  try {
    const raw = fs.readFileSync(claudeConfigPath(), "utf8").replace(/^\uFEFF/, "");
    const config = JSON.parse(raw);
    return Boolean(config && config.mcpServers && config.mcpServers[SERVER_NAME]);
  } catch {
    return false;
  }
}

function nodeVersionAtLeast() {
  const current = process.versions.node.split(".").map(Number);
  return current[0] > MIN_NODE[0] ||
    (current[0] === MIN_NODE[0] && (current[1] > MIN_NODE[1] ||
      (current[1] === MIN_NODE[1] && current[2] >= MIN_NODE[2])));
}

function commandLine() {
  return "claude " + COMMAND.join(" ");
}

function printHint() {
  process.stdout.write(
    "Browser verification: chrome-devtools MCP is not configured.\n" +
    "  " + commandLine() + "\n" +
    "  Requires Node.js 20.19+ and Chrome 144+ with remote debugging enabled at chrome://inspect/#remote-debugging.\n" +
    "  Or rerun with --with-browser-mcp to configure it automatically.\n"
  );
}

function main() {
  const args = new Set(process.argv.slice(2));
  const ensure = args.has("--ensure");
  const dryRun = args.has("--dry-run");

  if (hasServer()) {
    process.stdout.write("Browser verification: chrome-devtools MCP is already configured.\n");
    return;
  }
  if (!ensure) {
    printHint();
    return;
  }
  if (dryRun) {
    process.stdout.write("[dry-run] " + commandLine() + "\n");
    return;
  }
  if (!nodeVersionAtLeast()) {
    process.stderr.write(
      "chrome-devtools MCP requires Node.js 20.19+; current Node.js is " +
      process.versions.node + ".\n"
    );
    process.exitCode = 1;
    return;
  }

  const claude = process.platform === "win32" ? "claude.cmd" : "claude";
  const result = spawnSync(claude, COMMAND, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) {
    process.stderr.write(
      "Failed to configure chrome-devtools MCP. Run manually:\n  " + commandLine() + "\n"
    );
    process.exitCode = result.status || 1;
  }
}

main();
