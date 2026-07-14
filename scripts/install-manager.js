#!/usr/bin/env node
"use strict";

const path = require("node:path");

const {
  doctorWorkflow,
  installWorkflow,
} = require("./lib/managed-install");

const ROOT_DIR = path.resolve(__dirname, "..");

function usage() {
  process.stdout.write(`CEW installer

用法：
  node scripts/install-manager.js install [options]
  node scripts/install-manager.js doctor [options]

选项：
  --claude-only       只处理 ~/.claude
  --codex-only        只处理 ~/.codex
  --profile <name>    core | coding | full（默认 full）
  --dry-run           只预览，不写入
  -h, --help          显示帮助
`);
}

function parseArgs(args) {
  const options = {
    targets: ["claude", "codex"],
    profile: "full",
    dryRun: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--claude-only") {
      options.targets = ["claude"];
      continue;
    }
    if (arg === "--codex-only") {
      options.targets = ["codex"];
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--profile") {
      const profile = args[index + 1];
      if (!profile) throw new Error("--profile 需要一个值");
      options.profile = profile;
      index += 1;
      continue;
    }
    if (arg.startsWith("--profile=")) {
      options.profile = arg.slice("--profile=".length);
      continue;
    }
    throw new Error(`未知选项：${arg}`);
  }
  return options;
}

function main() {
  const [command = "install", ...args] = process.argv.slice(2);
  if (command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }
  const options = parseArgs(args);
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) throw new Error("缺少 HOME 或 USERPROFILE 环境变量");
  if (command === "install") {
    installWorkflow({ rootDir: ROOT_DIR, homeDir, ...options });
    process.stdout.write("安装完成。\n");
    return;
  }
  if (command === "doctor") {
    const reports = doctorWorkflow({ homeDir, targets: options.targets });
    const hasDrift = reports.some(
      (report) =>
        !report.installed ||
        report.missing.length > 0 ||
        report.modified.length > 0,
    );
    if (hasDrift) process.exitCode = 1;
    return;
  }
  throw new Error(`未知命令：${command}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`CEW 安装器失败：${error.message}\n`);
  process.exitCode = 1;
}
