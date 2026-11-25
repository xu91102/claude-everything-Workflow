#!/usr/bin/env node
"use strict";

/**
 * 可选真实模型路由场景评测脚本（不进入 CI，需本地已登录 claude 或 codex CLI）。
 * 用法：
 *   node scripts/eval-scenarios.js --host claude --limit 5
 *   node scripts/eval-scenarios.js --host codex --id bug-diagnosis --repeat 3
 *
 * --repeat N 对每个场景采样 N 次；全部命中为 PASS；全部有效但选路不一致为 UNSTABLE；宿主或回答格式异常为 FAIL。
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const scenariosPath = path.join(root, "evals/routing-scenarios.json");

function parseArgs(argv) {
  const opts = { host: "claude", limit: Infinity, id: null, repeat: 1, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--host") opts.host = argv[++i];
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
    else if (arg === "--id") opts.id = argv[++i];
    else if (arg === "--repeat") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("--repeat must be a positive integer");
      }
      opts.repeat = value;
    } else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "-h" || arg === "--help") {
      console.log(
        "Usage: node scripts/eval-scenarios.js " +
        "[--host claude|codex] [--limit N] [--id <id>] [--repeat N] [--dry-run]",
      );
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
    "这是一个只读工作流路由测试：只做选路，不执行下方用户请求，不修改任何文件。",
    "根据本仓库的 AGENTS.md、工作流路由、Skill 说明和它们引用的规则，判断分发后由哪个文件直接负责用户当前要做的事。只查工作流文档，不查场景题库、测试、评测脚本或提交记录。",
    "通用路由器只负责转交时，沿分发继续判断；路由器自己完成请求时，可以是答案。多阶段任务按当前要解决的具体问题选负责方。配套参考资料和后续步骤不作为本次目标。",
    "只输出一个 JSON 对象，target 填该 Skill 或规则的完整仓库相对文件路径；目标必须是 Skill 入口（`.../SKILL.md`）或规则文件，" +
      "不要填 Skill 内部的 `references/` 文档。无需进入工程流程时填字符串 NONE。不要加 Markdown 围栏。",
    "",
    `用户请求：${scenario.prompt}`,
  ].join("\n");
}

function runHost(host, prompt) {
  const options = { cwd: root, encoding: "utf8", timeout: 120000 };
  if (host === "claude") {
    const result = spawnSync("claude", ["-p", "--output-format", "text", prompt], options);
    return { result, answer: result.stdout };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cew-eval-"));
  try {
    const finalMessage = path.join(dir, "answer.json");
    const result = spawnSync("codex", ["exec", "--output-last-message", finalMessage, prompt], options);
    const answer = result.status === 0 && fs.existsSync(finalMessage) ? fs.readFileSync(finalMessage, "utf8") : "";
    return { result, answer };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function selectedTarget(answer) {
  const text = String(answer || "").trim();
  const fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```$/i.exec(text);
  try {
    const value = JSON.parse(fenced ? fenced[1] : text);
    return typeof value?.target === "string" && value.target.trim() ? value.target : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
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
    const expected = scenario.expectedTarget ?? "NONE";
    const samples = [];
    for (let i = 0; i < opts.repeat; i += 1) {
      const { result, answer } = runHost(opts.host, evalPrompt);
      const hostFailed = result.status !== 0 || Boolean(result.error);
      samples.push({
        status: result.status,
        hostFailed,
        target: hostFailed ? null : selectedTarget(answer),
        diagnostic: (result.error?.message || result.stderr || "").trim().slice(0, 200),
      });
    }
    const targets = samples.map((sample) => sample.target);
    const ok = targets.every((target) => target === expected);
    const unstable = !targets.includes(null) && new Set(targets).size > 1;
    if (ok) passed += 1;
    console.log(
      `${ok ? "PASS" : unstable ? "UNSTABLE" : "FAIL"} ${scenario.id} ` +
      `(expected: ${expected}) samples=${JSON.stringify(targets)}`,
    );
    for (const sample of samples) {
      if (sample.target === expected) continue;
      const reason = sample.hostFailed ? "host-error" : sample.target === null ? "invalid-answer" : "wrong-target";
      console.log(
        `  exit=${sample.status} target=${JSON.stringify(sample.target)} ` +
        `reason=${reason} ${sample.diagnostic}`,
      );
    }
  }
  console.log(`\nSummary: ${passed}/${list.length} passed.`);
  if (passed !== list.length) process.exitCode = 1;
}

main();
