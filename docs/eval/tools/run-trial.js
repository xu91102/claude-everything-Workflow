#!/usr/bin/env node
"use strict";

// Run one benchmark trial and persist its score. Python is needed only by the tested repositories.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn, spawnSync } = require("node:child_process");
const { parseArgs } = require("node:util");
const { XMLParser, XMLValidator } = require("fast-xml-parser");
const { collectCodexUsage, auditCodexModels } = require("./codex-usage.js");

const root = process.env.CEW_EVAL_ROOT || "/tmp/cew-eval";
const homes = Object.fromEntries(["codex-base", "cew-home", "claude-base", "cew-lite", "cew-trim", "cew-fixed"]
  .map((name) => [name, path.join(root, "homes", name)]));
const cells = Object.fromEntries([
  ["gpt-base", "codex-base"], ["gpt-cew", "cew-home"], ["gpt-lite", "cew-lite"],
  ["gpt-trim", "cew-trim"], ["gpt-fixed", "cew-fixed"], ["opus-base", "claude-base"], ["opus-cew", "cew-home"],
].map(([name, home]) => [name, { kind: name.startsWith("gpt-") ? "codex" : "claude", home: homes[home] }]));

const codexConfig = `model = "gpt-6.1-sol"
model_reasoning_effort = "high"
approval_policy = "never"
sandbox_mode = "workspace-write"
suppress_unstable_features_warning = true
`;

function sh(args, { cwd, env, input, check = true } = {}) {
  const result = spawnSync(args[0], args.slice(1), { cwd, env, input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (check && result.status !== 0) throw new Error(`${args[0]} exited ${result.status}: ${result.stderr}`);
  return { stdout: result.stdout || "", stderr: result.stderr || "", exit: result.status ?? -1 };
}

function ensureHomes() {
  for (const home of [homes["codex-base"], homes["cew-home"]]) {
    fs.mkdirSync(path.join(home, ".codex"), { recursive: true });
    const config = path.join(home, ".codex", "config.toml");
    if (!fs.existsSync(config)) fs.writeFileSync(config, codexConfig);
  }
  for (const home of [homes["claude-base"], homes["cew-home"]]) {
    fs.mkdirSync(home, { recursive: true });
    const file = path.join(home, ".claude.json");
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ hasCompletedOnboarding: true, hasTrustDialogAccepted: true }));
  }
}

function prepare(task, runDir) {
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(runDir), { recursive: true });
  const repo = path.join(root, "repos", task.repo);
  const base = task.parent || `${task.commit}^`;
  sh(["git", "clone", "--quiet", "--no-hardlinks", repo, runDir]);
  const git = (...args) => sh(["git", ...args], { cwd: runDir });
  git("checkout", "--quiet", "-B", "work", base);
  git("remote", "remove", "origin");
  for (const tag of git("tag").stdout.split(/\s+/).filter(Boolean)) git("tag", "-d", tag);
  for (const ref of git("for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes").stdout.split(/\s+/).filter(Boolean)) {
    if (ref !== "refs/heads/work") git("update-ref", "-d", ref);
  }
  git("reflog", "expire", "--expire=now", "--all");
  git("gc", "--prune=now", "--quiet");
  // Frozen replay manifests can preserve a corrected black-box fixture without a synthetic Git object.
  const patch = task.test_patch ?? sh(["git", "diff", base, task.commit, "--", ...task.test_files], { cwd: repo }).stdout;
  sh(["git", "apply", "-"], { cwd: runDir, input: patch });
  const patched = [...git("diff", "--name-only", "-z").stdout.split("\0"),
    ...git("ls-files", "--others", "--exclude-standard", "-z").stdout.split("\0")].filter(Boolean);
  if (patched.some((file) => !task.test_files.includes(file))) {
    throw new Error("Replay patch may only modify declared target test files");
  }
  if (task.repo === "humanize") {
    fs.writeFileSync(path.join(runDir, "src/humanize/_version.py"), '__version__ = "0.0.0"\n');
    fs.appendFileSync(path.join(runDir, ".git/info/exclude"), "\nsrc/humanize/_version.py\n");
  }
  git("add", "-A");
  git("-c", "user.email=eval@local", "-c", "user.name=eval", "commit", "-qm", "Add regression tests for the reported issue");
}

function testEnv(cell) {
  const cfg = cells[cell];
  const env = { ...process.env, HOME: cfg.home, PYTHONDONTWRITEBYTECODE: "1" };
  if (cfg.kind === "codex") env.CODEX_HOME = path.join(cfg.home, ".codex");
  return env;
}

function parseReport(file) {
  const result = { passed: 0, failed: 0, skipped: 0, errors: 0, failed_names: [], report_error: "" };
  try {
    const xml = fs.readFileSync(file, "utf8");
    if (/<!DOCTYPE/i.test(xml)) throw new Error("JUnit reports must not declare a DTD");
    const valid = XMLValidator.validate(xml);
    if (valid !== true) throw new Error(valid.err.msg);
    const tree = new XMLParser({ ignoreAttributes: false, parseAttributeValue: false }).parse(xml);
    function visit(node) {
      if (!node || typeof node !== "object") return;
      for (const [name, value] of Object.entries(node)) {
        for (const child of Array.isArray(value) ? value : [value]) {
          if (name === "testcase") {
            if (Object.hasOwn(child, "failure") || Object.hasOwn(child, "error")) {
              result.failed++;
              if (Object.hasOwn(child, "error")) result.errors++;
              result.failed_names.push(`${child["@_classname"] || ""}::${child["@_name"] || ""}`);
            } else if (Object.hasOwn(child, "skipped")) result.skipped++;
            else result.passed++;
          } else visit(child);
        }
      }
    }
    visit(tree);
  } catch (error) {
    result.report_error = error.message;
  }
  return result;
}

function runPytest(runDir, repo, testFiles, junit) {
  const src = path.join(runDir, "src");
  const env = { ...process.env, PYTHONPATH: fs.existsSync(src) ? src : runDir,
    PYTHONDONTWRITEBYTECODE: "1", NO_PROXY: "127.0.0.1,localhost" };
  delete env.HTTP_PROXY;
  // A repeated trial must never reuse an earlier report.
  fs.rmSync(junit, { force: true });
  const args = [path.join(root, "venvs", repo, "bin/python"), "-m", "pytest", "-q", "--tb=no",
    "-p", "no:cacheprovider", "--maxfail=0", `--junitxml=${junit}`, ...(testFiles || [])];
  const result = sh(args, { cwd: runDir, env, check: false });
  return { ...parseReport(junit), exit: result.exit, tail: result.stdout.slice(-500) };
}

function pytestCompleted(result) {
  // Exit 1 is valid for known baseline failures; interruption and collection errors are not.
  return !result.report_error && result.errors === 0 && [0, 1].includes(result.exit)
    && result.passed + result.failed > 0
    && (result.exit === 0) === (result.failed === 0);
}

async function runAgent(cell, runDir, prompt, logPath, timeout) {
  const cfg = cells[cell];
  const env = testEnv(cell);
  const profile = cfg.kind === "codex" ? env.CEW_EVAL_PERMISSION_PROFILE : undefined;
  if (profile && !/^[a-z][a-z0-9_-]*$/.test(profile)) throw new Error("Invalid private permissions profile");
  if (profile && /^\s*(?:sandbox_mode\s*=|\[sandbox_workspace_write\])/m.test(fs.readFileSync(path.join(env.CODEX_HOME,"config.toml"),"utf8"))) {
    throw new Error("Legacy sandbox settings would override the private read boundary");
  }
  const permissions = profile ? ["-c", `default_permissions=${JSON.stringify(profile)}`] : ["--sandbox", "workspace-write"];
  const cmd = cfg.kind === "codex"
    ? ["codex", "exec", "--skip-git-repo-check", "--json", "-C", runDir, "-m", "gpt-6.1-sol",
      ...permissions, "-c", 'approval_policy="never"', "-c", 'model_reasoning_effort="high"', prompt]
    : ["claude", "-p", prompt, "--model", "opus", "--output-format", "json", "--dangerously-skip-permissions",
      "--max-turns", "80", "--settings", path.join(root, "clean-settings.json")];
  if (cfg.kind === "claude") {
    delete env.ANTHROPIC_AUTH_TOKEN;
    env.ANTHROPIC_BASE_URL = "https://api.anthropic.com";
  }
  const start = Date.now();
  const log = fs.openSync(logPath, "w");
  const child = spawn(cmd[0], cmd.slice(1), { cwd: runDir, env, detached: process.platform !== "win32", stdio: ["ignore", log, log] });
  fs.closeSync(log);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      if (process.platform === "win32") child.kill("SIGKILL");
      else process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") child.emit("error", error);
    }
  }, timeout * 1000);
  try {
    const exit = await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code, signal) => resolve(code ?? -(os.constants.signals[signal] || 1)));
    });
    return { exit, timed_out: timedOut, duration_s: Math.round((Date.now() - start) / 100) / 10, log: logPath };
  } finally {
    clearTimeout(timer);
  }
}

function parseUsage(cell, logPath) {
  const text = fs.readFileSync(logPath, "utf8");
  if (cells[cell].kind === "codex") {
    const usage = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 };
    let final = "";
    let rootThreadId;
    for (const line of text.split("\n")) {
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      if (event.type === "thread.started" && !rootThreadId) rootThreadId = event.thread_id;
      if (event.type === "turn.completed") {
        for (const key of Object.keys(usage)) usage[key] += Number(event.usage?.[key] || 0);
      }
      if (event.type === "item.completed" && event.item?.type === "agent_message") final = event.item.text || "";
    }
    return { usage, final, rootThreadId };
  }
  let data;
  try { data = JSON.parse(text.trim().split("\n").at(-1)); } catch { return { usage: {}, final: "" }; }
  const usage = data.usage || {};
  return { usage: { input_tokens: usage.input_tokens || 0, cached_input_tokens: usage.cache_read_input_tokens || 0,
    cache_write_tokens: usage.cache_creation_input_tokens || 0, output_tokens: usage.output_tokens || 0,
    turns: data.num_turns || 0, cost_usd: data.total_cost_usd || 0 }, final: data.result || "" };
}

async function main() {
  const { values } = parseArgs({ options: { cell: { type: "string" }, task: { type: "string" },
    timeout: { type: "string", default: "720" }, run: { type: "string", default: "1" } } });
  const cell = values.cell;
  const timeout = Number(values.timeout);
  const run = Number(values.run);
  if (!Object.hasOwn(cells, cell) || !/^[\w-]+$/.test(values.task || "")
      || !Number.isInteger(timeout) || timeout < 0 || !Number.isInteger(run) || run < 1) {
    throw new Error("Expected --task <id> --cell <known cell>, integer --run >= 1 and --timeout >= 0");
  }
  const task = JSON.parse(fs.readFileSync(path.join(root, "tasks.validated.json"), "utf8")).find((item) => item.id === values.task);
  if (!task) throw new Error(`Unknown task: ${values.task}`);
  ensureHomes();
  const outDir = path.join(root, "results", task.id, `${cell}-r${run}`);
  const runDir = path.join(root, "runs", task.id, `${cell}-r${run}`);
  fs.mkdirSync(outDir, { recursive: true });
  prepare(task, runDir);
  const git = (...args) => sh(["git", ...args], { cwd: runDir });
  const baseHead = git("rev-parse", "HEAD").stdout.trim();
  const isTest = (file) => task.test_files.includes(file) || /(?:^|\/)tests?\//.test(file)
    || /(?:^|\/)(?:test[^/]*|[^/]+_test|conftest)\.py$/.test(file)
    || /(?:^|\/)(?:pytest\.ini|\.pytest\.ini|tox\.ini|setup\.cfg|pyproject\.toml)$/.test(file);
  const frozenTests = new Map(git("ls-files", "-z").stdout.split("\0").filter((file) => file && isTest(file))
    .map((file) => [file, fs.readFileSync(path.join(runDir, file))]));
  const baseTarget = runPytest(runDir, task.repo, task.test_files, path.join(outDir, "base-target.xml"));
  const baseFull = runPytest(runDir, task.repo, null, path.join(outDir, "base-full.xml"));
  const prompt = `Fix this issue in the repository.\n\nIssue: ${task.issue}\n\n`
    + "Work only in the current checkout. Do not modify test files. Do not commit, push, or open a pull request. "
    + "Run the relevant tests and make sure they pass.";
  const log = path.join(outDir, "agent.log");
  const baselineValid = pytestCompleted(baseTarget) && baseTarget.failed > 0 && pytestCompleted(baseFull);
  if (process.env.CEW_EVAL_HIDE_REFERENCES === "1") {
    const link = path.join(root,"repos");
    if (!fs.lstatSync(link).isSymbolicLink()) throw new Error("Reference hiding requires a private repository symlink");
    fs.unlinkSync(link);
  }
  if (!baselineValid) fs.writeFileSync(log, "");
  const agent = baselineValid ? await runAgent(cell, runDir, prompt, log, timeout)
    : {exit:-1,timed_out:false,duration_s:0,log,not_run:"Invalid challenge baseline"};
  const headModified = git("rev-parse", "HEAD").stdout.trim() !== baseHead;
  const currentFiles = [...new Set(git("ls-files", "--cached", "--others", "-z").stdout.split("\0").filter(Boolean))];
  const newProtectedFiles = currentFiles.filter((file) => isTest(file) && !frozenTests.has(file));
  const testsModified = [...frozenTests].some(([file, bytes]) => !fs.existsSync(path.join(runDir, file))
    || !fs.lstatSync(path.join(runDir, file)).isFile()
    || !bytes.equals(fs.readFileSync(path.join(runDir, file)))) || newProtectedFiles.length > 0;
  if (newProtectedFiles.length) git("add", "--intent-to-add", "--force", "--", ...newProtectedFiles);
  fs.writeFileSync(path.join(outDir, "agent.diff"), git("diff", "--binary", baseHead).stdout);
  if (frozenTests.size) git("restore", "--source", baseHead, "--staged", "--worktree", "--", ...frozenTests.keys());
  if (newProtectedFiles.length) {
    git("rm", "--cached", "--force", "--ignore-unmatch", "--", ...newProtectedFiles);
    for (const file of newProtectedFiles) fs.rmSync(path.join(runDir, file), { force:true });
  }
  git("add", "-A");
  const files = [], srcFiles = [];
  let added = 0, deleted = 0;
  for (const line of git("diff", "--cached", "--numstat", "HEAD").stdout.split("\n")) {
    const parts = line.split("\t");
    if (parts.length !== 3) continue;
    files.push(parts[2]);
    if (/^\d+$/.test(parts[0])) { added += Number(parts[0]); deleted += Number(parts[1]); }
    if (!parts[2].includes("test")) srcFiles.push(parts[2]);
  }
  const target = runPytest(runDir, task.repo, task.test_files, path.join(outDir, "target.xml"));
  const afterFull = runPytest(runDir, task.repo, null, path.join(outDir, "after-full.xml"));
  const newFailures = [...new Set(afterFull.failed_names.filter((name) => !baseFull.failed_names.includes(name)))].sort();
  const reportsComplete = [baseTarget, baseFull, target, afterFull].every(pytestCompleted);
  const targetPassed = pytestCompleted(target) && target.exit === 0 && target.passed > 0;
  const parsed = parseUsage(cell, agent.log);
  const rawCliUsage = parsed.usage;
  let usage = rawCliUsage, usageAccounting = null, usageError = null, modelAudit = null;
  if (cells[cell].kind === "codex") {
    try {
      usageAccounting = collectCodexUsage(path.join(cells[cell].home, ".codex/sessions"), parsed.rootThreadId, rawCliUsage,
        { allowIncompleteCli: agent.exit !== 0 || agent.timed_out });
      usage = usageAccounting.usage;
      modelAudit = auditCodexModels(path.join(cells[cell].home,".codex/sessions"),usageAccounting);
    } catch (error) {
      usageError = error.message;
      usage = null;
    }
  }
  const resolved = agent.exit === 0 && !agent.timed_out && baselineValid && reportsComplete && targetPassed
    && newFailures.length === 0 && !testsModified && !headModified && !usageError
    && (cells[cell].kind !== "codex" || modelAudit?.status === "PASS");
  const final = parsed.final;
  const overclaim = /(all tests? (pass|passing)|tests? pass|everything passes|全部通过|测试通过)/i.test(final)
    && !(reportsComplete && targetPassed && newFailures.length === 0);
  const summary = (report) => Object.fromEntries(["passed", "failed", "skipped", "errors", "exit", "report_error"].map((key) => [key, report[key]]));
  const result = { task: task.id, repo: task.repo, cell, run, agent, usage, final_message: final.slice(-4000),
    raw_cli_usage: rawCliUsage, usage_accounting: usageAccounting, usage_error: usageError,
    model_audit: modelAudit,
    target, base_target: summary(baseTarget), base_full: summary(baseFull), after_full: summary(afterFull),
    baseline_valid: baselineValid, base_head: baseHead, head_modified: headModified, new_failures: newFailures.slice(0, 20),
    tests_modified: testsModified, diff: { files, src_files: srcFiles, added, deleted, lines: added + deleted }, resolved, overclaim };
  fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(Object.fromEntries(["task", "cell", "run", "resolved", "overclaim", "usage", "diff", "new_failures", "tests_modified"]
    .map((key) => [key, result[key]]))));
}

module.exports = { prepare, runPytest, pytestCompleted, parseReport, runAgent, parseUsage };
if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
