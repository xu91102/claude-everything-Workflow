#!/usr/bin/env node
"use strict";

/**
 * 可选真实模型路由场景评测脚本（不进入 CI，需本地已登录 claude 或 codex CLI）。
 * 用法：
 *   node scripts/eval-scenarios.js --host claude --limit 5
 *   node scripts/eval-scenarios.js --host codex --id bug-diagnosis
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const scenariosPath = path.join(root, "evals/routing-scenarios.json");

function parseArgs(argv) {
  const opts = { host: "claude", limit: Infinity, id: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--host") opts.host = argv[++i];
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
    else if (arg === "--id") opts.id = argv[++i];
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "-h" || arg === "--help") {
      console.log("Usage: node scripts/eval-scenarios.js [--host claude|codex] [--limit N] [--id <id>] [--dry-run]");
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!["claude", "codex"].includes(opts.host)) {
    throw new Error(`Unsupported --host: ${opts.host}`);
  }
  return opts;
}

function buildEvalPrompt(scenario) {
  return [
    "这是一个只读工作流路由测试：不要修改任何文件，不要执行写操作。",
    "请根据当前仓库的 AGENTS.md、skills/using-superpowers/SKILL.md 与各 skill 的 description，回答面对以下用户请求时，第一步应该选择哪个 Skill/规则路径（若无需进入工程路由则回答 NONE），并用一句话说明理由。",
    "",
    `用户请求：${scenario.prompt}`,
  ].join("\n");
}

function runHost(host, prompt) {
  if (host === "claude") {
    return spawnSync("claude", ["-p", prompt], { cwd: root, encoding: "utf8", timeout: 120000 });
  }
  return spawnSync("codex", ["exec", prompt], { cwd: root, encoding: "utf8", timeout: 120000 });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const data = JSON.parse(fs.readFileSync(scenariosPath, "utf8"));
  let list = data.scenarios;
  if (opts.id) list = list.filter((s) => s.id === opts.id);
  if (Number.isFinite(opts.limit)) list = list.slice(0, opts.limit);

  let passed = 0;
  for (const scenario of list) {
    const evalPrompt = buildEvalPrompt(scenario);
    if (opts.dryRun) {
      console.log(`[dry-run] ${scenario.id} -> expected: ${scenario.expectedTarget || "NONE"}`);
      passed += 1;
      continue;
    }
    const res = runHost(opts.host, evalPrompt);
    const out = `${res.stdout || ""}\n${res.stderr || ""}`;
    const expectedToken = scenario.expectedTarget
      ? path.basename(path.dirname(scenario.expectedTarget)) === "skills"
        ? scenario.expectedTarget
        : scenario.expectedTarget.startsWith("skills/")
          ? scenario.expectedTarget.split("/")[1]
          : path.basename(scenario.expectedTarget)
      : "none";
    const ok = res.status === 0 && out.toLowerCase().includes(expectedToken.toLowerCase());
    if (ok) passed += 1;
    console.log(`${ok ? "PASS" : "FAIL"} ${scenario.id} (expected: ${scenario.expectedTarget || "NONE"})`);
    if (!ok) {
      console.log(`  exit=${res.status} snippet=${out.trim().slice(0, 200).replace(/\s+/g, " ")}`);
    }
  }
  console.log(`\nSummary: ${passed}/${list.length} passed.`);
  if (passed !== list.length) process.exitCode = 1;
}

main();
