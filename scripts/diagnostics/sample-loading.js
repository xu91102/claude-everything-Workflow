#!/usr/bin/env node
"use strict";

// Opt-in local model experiment. Never invoked by doctor, loading, verify or CI.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { options } = require("./capabilities");
const { analyze } = require("./loading");
const source = path.resolve(__dirname, "../..");

function write(root, relative, body) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function prepare(scenario, root) {
  const broken = scenario.id === "small-fix";
  write(root, "src/total.js", `"use strict";\nexports.total = (values) => values.reduce((a, b) => a + b${broken ? "" : ", 0"});\n`);
  write(root, "test/total.test.js", 'const { test } = require("node:test");\nconst assert = require("node:assert/strict");\nconst { total } = require("../src/total");\ntest("adds values", () => assert.equal(total([1, 2, 3]), 6));\n' +
    (broken ? "" : 'test("empty array", () => assert.equal(total([]), 0));\n'));
  write(root, "package.json", JSON.stringify({ name: "cew-loading-fixture", private: true, scripts: { test: "node --test", verify: "node --test" } }, null, 2) + "\n");
  write(root, ".gitignore", "docs/superpowers/\n.evidence/\n");
  const acceptance = scenario.id === "acceptance-run";
  write(root, "AGENTS.md", fs.readFileSync(path.join(source, "AGENTS.md"), "utf8") +
    '\n## 采样项目\n测试入口 `npm test`。仅处理当前用户请求，不提交、推送或访问外部服务。\n' +
    '为准确采样，读取规则、技能和参考文件时使用不截断的 cat，单次最多读取三份文件；不因此多读额外文件。\n' +
    (acceptance ? '验收入口 `.agents/skills/verify-loading-fixture/SKILL.md`，功能地图见该目录的 `references/features.md`。\n' : ""));
  if (acceptance) {
    write(root, ".agents/skills/verify-loading-fixture/SKILL.md", '---\nname: verify-loading-fixture\ndescription: Verify the total library through its public API.\n---\n\nRun `npm run verify` from the project root; require exit 0 and both scenarios passing.\nFeature map: [features](references/features.md). Record code revision, command, exit code and output in `.evidence/`; read the evidence again before reporting. No service or account is required.\n');
    write(root, ".agents/skills/verify-loading-fixture/references/features.md", '# total 功能地图\n\n- 正常输入：公开函数 total([1,2,3]) 返回 6，test/total.test.js 覆盖。\n- 空数组：total([]) 返回 0，同一测试文件覆盖。\n- 范围：纯本地 Node 库，不涉及 UI、账号或网络。\n');
  }
  for (const args of [["init", "--initial-branch=sample-task"], ["add", "."], ["-c", "user.name=CEW Sample", "-c", "user.email=sample@example.invalid", "-c", "core.hooksPath=/dev/null", "commit", "-m", "fixture baseline"]]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
  }
}

function main() {
  const opts = options(process.argv.slice(2), ["--output", "--case", "--timeout-ms", "--help"]);
  if (opts["--help"]) {
    console.log("node scripts/diagnostics/sample-loading.js --output NEW_DIR [--case ID] [--timeout-ms 1000..180000]\nRuns five fresh Codex CLI model sessions by default; consumes quota. Uses current host config and user skills. Stores local traces, fixtures and reports. Never edits the CEW installation.");
    return;
  }
  if (!opts["--output"]) throw new Error("--output is required");
  const timeout = opts["--timeout-ms"] === undefined ? 180000 : Number(opts["--timeout-ms"]);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 180000) throw new Error("--timeout-ms must be an integer from 1000 to 180000");
  const output = path.resolve(opts["--output"]);
  if (fs.existsSync(output)) throw new Error("Output directory already exists; choose a new one to preserve evidence");
  const cases = require("../../harness/loading/cases.json").cases.filter((item) => !opts["--case"] || item.id === opts["--case"]);
  if (!cases.length) throw new Error("Unknown case");
  fs.mkdirSync(output, { recursive: true });
  const cliVersion = spawnSync("codex", ["--version"], { encoding: "utf8" });
  if (cliVersion.status !== 0) throw new Error("Codex CLI is unavailable");
  const summary = [];
  for (const scenario of cases) {
    const dir = path.join(output, scenario.id);
    fs.mkdirSync(dir);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cew-loading-fixture-"));
    prepare(scenario, root);
    const trace = path.join(dir, "trace.jsonl");
    const stderr = path.join(dir, "stderr.log");
    const out = fs.openSync(trace, "w");
    const err = fs.openSync(stderr, "w");
    console.log(`Sampling ${scenario.id} in ${root}`);
    let result;
    try {
      result = spawnSync("codex", ["exec", "--json", "--sandbox", "workspace-write", "-C", root, scenario.prompt], {
        stdio: ["ignore", out, err], timeout,
      });
    } finally { fs.closeSync(out); fs.closeSync(err); }
    const report = { caseId: scenario.id, commandExitCode: result.status, signal: result.signal, error: result.error?.message || null,
      cliVersion: cliVersion.stdout.trim(), fixture: root, prompt: scenario.prompt, behavioralReview: "NOT_RUN" };
    try {
      const hostRoot = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
      report.loading = analyze({ trace, caseId: scenario.id, roots: [hostRoot, root] });
    } catch (error) { report.analysisError = error.message; }
    write(dir, "report.json", JSON.stringify(report, null, 2) + "\n");
    summary.push(report);
    write(output, "summary.json", JSON.stringify(summary, null, 2) + "\n");
    console.log(`${scenario.id}: exit=${result.status} ${report.loading?.assessment || report.analysisError}`);
    // Preserve incomplete evidence and stop on a failed model invocation; no quota-burning retry loop.
    if (result.error || result.signal || result.status !== 0) { process.exitCode = 1; break; }
  }
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 2; }
