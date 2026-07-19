"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const { prepareLiveRuntime } = require(path.join(root, "scripts/eval/live-runtime.js"));

function testLiveRuntime(options) {
  return prepareLiveRuntime({ ...options, resolveCommand: () => process.execPath });
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

function perfectQualityGates() {
  return {
    taskSuccessRate: { min: 1 },
    unnecessaryQuestionRate: { max: 0 },
    falseGateRate: { max: 0 },
    verificationTruthfulness: { min: 1 },
  };
}

function noBlockingQuestions() {
  return { min: 0, max: 0, kinds: [] };
}

function noToolCalls() {
  return { min: 0, max: 0 };
}

function directorySymlinksAvailable(t) {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), "cew-symlink-probe-"));
  const target = path.join(probe, "target");
  const link = path.join(probe, "link");
  fs.mkdirSync(target);
  try {
    fs.symlinkSync(target, link, "dir");
    return true;
  } catch (error) {
    const permissionDenied =
      process.platform === "win32" && ["EACCES", "EPERM"].includes(error.code);
    if (!permissionDenied) throw error;
    t.skip(`directory symlinks are unavailable: ${error.code}`);
    return false;
  } finally {
    fs.rmSync(probe, { recursive: true, force: true });
  }
}

test("CI verifies Node 18, 20 and 22 with a Windows runner", () => {
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /runs-on: \$\{\{ matrix\.os \}\}/);
  assert.match(workflow, /os: windows-latest/);
  for (const version of ["18", "20", "22"]) {
    assert.match(workflow, new RegExp(`node: ["']?${version}["']?`));
  }
});

test("cew help exposes the eval command", () => {
  const result = runNode(["bin/claude-everything-workflow.js", "--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /cew eval/);
  assert.match(result.stdout, /--trust-replay/);
});

test("default eval completes through the offline replay adapter", () => {
  const result = runNode([
    "bin/claude-everything-workflow.js",
    "eval",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.adapter, "replay");
  assert.equal(report.mode, "offline");
  assert.equal(report.complete, true);
  assert.equal(report.passed, true);
});

test("split verifier preserves latest-main policy checks", () => {
  const result = runNode(["scripts/verify-harness.js"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Harness verification passed/);

  const policy = require(path.join(root, "scripts/verify/policy-checks.js"));
  assert.equal(typeof policy.checkRemovedSkillReferences, "function");
  assert.equal(typeof policy.checkSuperpowersDevLoop, "function");

  const structure = require(
    path.join(root, "scripts/verify/structure-checks.js"),
  );
  assert.equal(typeof structure.checkSkillLinks, "function");
});

test("metrics count rounds, coverage, false gates and verification evidence", () => {
  const { computeMetrics, evaluateGates } = require(
    path.join(root, "scripts/eval/metrics.js"),
  );
  const metrics = computeMetrics([
    {
      expectedDecision: "completed",
      decision: "completed",
      adapterCompleted: true,
      oraclePassed: true,
      blockingQuestions: 0,
      toolRounds: [1, 1, 2],
      toolCalls: 3,
      usage: {
        freshInputTokens: 10,
        cachedInputTokens: 5,
        outputTokens: 2,
      },
      verificationRequired: true,
      verificationEvidencePassed: true,
    },
    {
      expectedDecision: "completed",
      decision: "needs_input",
      adapterCompleted: true,
      oraclePassed: false,
      blockingQuestions: 1,
      toolRounds: [],
      toolCalls: 0,
      usage: null,
      verificationRequired: false,
      verificationEvidencePassed: false,
    },
  ]);

  assert.equal(metrics.taskSuccessRate, 0.5);
  assert.equal(metrics.unnecessaryQuestionRate, 0.5);
  assert.equal(metrics.falseGateRate, 0);
  assert.equal(metrics.toolRoundTrips.total, 2);
  assert.equal(metrics.toolRoundTrips.toolCalls, 3);
  assert.equal(metrics.toolRoundTrips.roundCoverage, 1);
  assert.equal(metrics.contextCost.totalInputTokens, 15);
  assert.equal(metrics.contextCost.usageCoverage, 0.5);
  assert.equal(metrics.verificationTruthfulness, 1);
  assert.equal(
    evaluateGates({
      metrics,
      gates: { unnecessaryQuestionRate: { max: 0 } },
    }).passed,
    false,
  );
});

test("fixture accepts spaces and Chinese while rejecting path escapes", () => {
  const { safeRelativePath } = require(
    path.join(root, "scripts/eval/core.js"),
  );
  assert.equal(
    safeRelativePath("目录 空格/文件.txt"),
    "目录 空格/文件.txt",
  );
  assert.throws(() => safeRelativePath("../escape"), {
    code: "E_PATH_BOUNDARY",
  });
  assert.throws(() => safeRelativePath("/absolute"), {
    code: "E_PATH_BOUNDARY",
  });
  assert.throws(() => safeRelativePath("bad\0name"), {
    code: "E_PATH_BOUNDARY",
  });
});

test("oracle rejects a claimed pass when workspace evidence is wrong", async () => {
  const { createFixture, runOracle } = require(
    path.join(root, "scripts/eval/core.js"),
  );
  const fixture = await createFixture({
    scenario: {
      id: "oracle-lie",
      fixture: { files: { "result.txt": "before\n" } },
      expect: {
        decision: "completed",
        questions: noBlockingQuestions(),
        toolCalls: noToolCalls(),
        files: [{ path: "result.txt", equals: "after\n" }],
        verification: [],
      },
    },
  });
  try {
    const result = await runOracle({
      scenario: fixture.scenario,
      fixture,
      run: {
        decision: "completed",
        questions: [],
        events: [
          {
            seq: 1,
            type: "final",
            round: 0,
            callId: "final",
            tool: "final",
            purpose: "final",
            ok: true,
          },
        ],
        verificationClaims: [],
      },
    });
    assert.equal(result.passed, false);
    assert.match(result.failures.join("\n"), /result\.txt/);
  } finally {
    await fixture.cleanup();
  }
});

test("runSuite preserves dirty files omitted from a replay snapshot", async () => {
  const { runSuite } = require(path.join(root, "scripts/eval/core.js"));
  const suite = {
    schemaVersion: 1,
    profile: {
      id: "quality-autonomy",
      decisionPolicy: {
        reversibleInScope: "act",
        discoverableLocalAmbiguity: "explore_then_act",
        externalOrIrreversible: "ask",
      },
      gates: perfectQualityGates(),
    },
    scenarios: [
      {
        id: "dirty-preserved",
        tags: ["dirty"],
        prompt: "修改 target.txt，保留 user.txt。",
        fixture: {
          files: {
            "target.txt": "before\n",
            "user.txt": "user change\n",
          },
        },
        expect: {
          decision: "completed",
          questions: noBlockingQuestions(),
          toolCalls: noToolCalls(),
          files: [
            { path: "target.txt", equals: "after\n" },
            { path: "user.txt", equals: "user change\n" },
          ],
          verification: [],
        },
      },
    ],
  };
  const adapter = {
    name: "replay",
    mode: "offline",
    async run() {
      return {
        decision: "completed",
        questions: [],
        events: [],
        usage: null,
        verificationClaims: [],
        workspace: { "target.txt": "after\n" },
      };
    },
  };

  const result = await runSuite({ suite, adapter });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].oraclePassed, true);
  assert.equal(result.fixturePaths.length, 0);
});

test("suite validation rejects duplicate ids and unknown fields", () => {
  const { validateSuite } = require(path.join(root, "scripts/eval/core.js"));
  const scenario = {
    id: "duplicate",
    tags: [],
    prompt: "test",
    fixture: { files: {} },
    expect: {
      decision: "completed",
      questions: noBlockingQuestions(),
      toolCalls: noToolCalls(),
      files: [],
      verification: [],
    },
  };
  const base = {
    schemaVersion: 1,
    profile: {
      id: "quality-autonomy",
      decisionPolicy: {
        reversibleInScope: "act",
        discoverableLocalAmbiguity: "explore_then_act",
        externalOrIrreversible: "ask",
      },
      gates: perfectQualityGates(),
    },
    scenarios: [scenario, { ...scenario }],
  };

  assert.throws(() => validateSuite(base), { code: "E_SCHEMA" });
  assert.throws(
    () => validateSuite({ ...base, scenarios: [scenario], unknown: true }),
    { code: "E_SCHEMA" },
  );
});

test("fixture cleanup removes its temporary directory", async () => {
  const { createFixture } = require(path.join(root, "scripts/eval/core.js"));
  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), "cew-core-test-"));
  try {
    const fixture = await createFixture({
      scenario: {
        id: "cleanup",
        fixture: { files: { "file.txt": "value\n" } },
        expect: {
          decision: "completed",
          questions: noBlockingQuestions(),
          toolCalls: noToolCalls(),
          files: [],
          verification: [],
        },
      },
      tempBase,
    });
    assert.equal(fs.existsSync(fixture.workspace), true);
    await fixture.cleanup();
    assert.equal(fs.existsSync(fixture.workspace), false);
  } finally {
    fs.rmSync(tempBase, { recursive: true, force: true });
  }
});

test("workspace oracle rejects symlinks that escape the fixture root", async (t) => {
  if (!directorySymlinksAvailable(t)) return;
  const { createFixture, runOracle } = require(
    path.join(root, "scripts/eval/core.js"),
  );
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "cew-outside-"));
  const fixture = await createFixture({
    scenario: {
      id: "symlink-escape",
      fixture: { files: {} },
      expect: {
        decision: "completed",
        questions: noBlockingQuestions(),
        toolCalls: noToolCalls(),
        files: [{ path: "link/value.txt", exists: false }],
        verification: [],
      },
    },
  });
  try {
    fs.symlinkSync(outside, path.join(fixture.workspace, "link"), "dir");
    await assert.rejects(
      runOracle({
        scenario: fixture.scenario,
        fixture,
        run: {
          decision: "completed",
          questions: [],
          events: [],
          verificationClaims: [],
        },
      }),
      { code: "E_PATH_BOUNDARY" },
    );
  } finally {
    await fixture.cleanup();
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("runSuite cleans fixtures when an adapter fails", async () => {
  const { runSuite } = require(path.join(root, "scripts/eval/core.js"));
  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), "cew-failure-test-"));
  const suite = {
    schemaVersion: 1,
    profile: {
      id: "quality-autonomy",
      decisionPolicy: {
        reversibleInScope: "act",
        discoverableLocalAmbiguity: "explore_then_act",
        externalOrIrreversible: "ask",
      },
      gates: perfectQualityGates(),
    },
    scenarios: [
      {
        id: "adapter-failure-cleanup",
        tags: [],
        prompt: "test cleanup",
        fixture: { files: {} },
        expect: {
          decision: "completed",
          questions: noBlockingQuestions(),
          toolCalls: noToolCalls(),
          files: [],
          verification: [],
        },
      },
    ],
  };
  try {
    await assert.rejects(
      runSuite({
        suite,
        tempBase,
        adapter: {
          async run() {
            throw new Error("adapter failed");
          },
        },
      }),
      /adapter failed/,
    );
    assert.deepEqual(fs.readdirSync(tempBase), []);
  } finally {
    fs.rmSync(tempBase, { recursive: true, force: true });
  }
});

test("replay never spawns and live adapters require explicit opt-in", async () => {
  const { createAdapter } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  let spawnCalls = 0;
  const spawnImpl = () => {
    spawnCalls += 1;
    throw new Error("spawned");
  };
  const replay = {
    schemaVersion: 1,
    runs: {
      sample: {
        decision: "needs_input",
        questions: [
          {
            blocking: true,
            kind: "architecture_direction",
            reason: "a material architecture choice is unresolved",
          },
        ],
        events: [
          {
            seq: 1,
            type: "final",
            round: 0,
            callId: "final",
            tool: "final",
            purpose: "final",
            ok: true,
          },
        ],
        roundCoverage: 1,
        usage: null,
        verificationClaims: [],
        workspace: {},
      },
    },
  };

  const offline = createAdapter({
    name: "replay",
    replay,
    live: false,
    spawnImpl,
  });
  const run = await offline.run({
    scenario: { id: "sample" },
    workspace: os.tmpdir(),
    prompt: "x",
  });
  assert.equal(run.decision, "needs_input");
  assert.equal(run.questions[0].kind, "architecture_direction");
  assert.equal(run.roundCoverage, 1);
  assert.equal(spawnCalls, 0);

  for (const name of ["codex", "claude"]) {
    assert.throws(
      () => createAdapter({ name, replay, live: false, spawnImpl }),
      { code: "E_LIVE_OPT_IN_REQUIRED" },
    );
  }
  assert.equal(spawnCalls, 0);
});

function jsonLines(events) {
  return events.map((event) => JSON.stringify(event)).join("\n");
}

function codexProtocolTrace(final) {
  return jsonLines([
    { type: "turn.started" },
    {
      type: "item.started",
      item: { id: "call-1", type: "command_execution", command: "npm test" },
    },
    {
      type: "item.completed",
      item: {
        id: "call-1",
        type: "command_execution",
        command: "npm test",
        exit_code: 0,
      },
    },
    {
      type: "item.completed",
      item: { id: "final", type: "agent_message", text: JSON.stringify(final) },
    },
    {
      type: "turn.completed",
      usage: { input_tokens: 12, cached_input_tokens: 3, output_tokens: 4 },
    },
  ]);
}

function claudeProtocolTrace(final) {
  return jsonLines([
    {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "call-1",
            name: "Bash",
            input: { command: "npm test" },
          },
        ],
      },
    },
    {
      type: "user",
      message: {
        content: [
          { type: "tool_result", tool_use_id: "call-1", is_error: false },
        ],
      },
    },
    {
      type: "result",
      structured_output: final,
      usage: {
        input_tokens: 20,
        cache_read_input_tokens: 7,
        output_tokens: 5,
      },
    },
  ]);
}

test("Codex and Claude JSONL normalize into the shared run contract", () => {
  const { normalizeClaudeEvents, normalizeCodexEvents } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const final = {
    decision: "completed",
    questions: [],
    verificationClaims: [{ checkId: "test", status: "passed" }],
  };
  const codex = normalizeCodexEvents(codexProtocolTrace(final));
  assert.equal(codex.decision, "completed");
  assert.equal(codex.roundCoverage, 0);
  assert.equal(codex.events.filter((event) => event.type === "tool_call").length, 1);
  assert.equal(codex.usage.freshInputTokens, 9);
  assert.equal(codex.usage.cachedInputTokens, 3);

  const claude = normalizeClaudeEvents(claudeProtocolTrace(final));
  assert.equal(claude.decision, "completed");
  assert.equal(claude.roundCoverage, 1);
  assert.equal(claude.events.filter((event) => event.type === "tool_result").length, 1);
  assert.equal(claude.usage.freshInputTokens, 20);
  assert.equal(claude.usage.cachedInputTokens, 7);
});

test("live Codex uses a sandboxed argument array without selecting a model", async () => {
  const { createAdapter } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-live-test-"));
  let invocation;
  const final = {
    decision: "completed",
    questions: [],
    verificationClaims: [],
  };
  try {
    const adapter = createAdapter({
      name: "codex",
      replay: { schemaVersion: 1, runs: {} },
      live: true,
      runtimeImpl: testLiveRuntime,
      timeoutMs: 1000,
      spawnImpl(command, args, options) {
        invocation = { command, args, options };
        return {
          status: 0,
          stdout: [
            JSON.stringify({ type: "turn.started" }),
            JSON.stringify({
              type: "item.completed",
              item: {
                id: "final",
                type: "agent_message",
                text: JSON.stringify(final),
              },
            }),
          ].join("\n"),
          stderr: "",
        };
      },
    });
    const run = await adapter.run({
      scenario: { id: "live" },
      workspace,
      prompt: "make a local edit",
    });
    assert.equal(run.decision, "completed");
    assert.equal(invocation.command, process.execPath);
    assert.equal(invocation.options.shell, false);
    assert.equal(invocation.options.cwd, workspace);
    assert.equal(invocation.args.includes("--ignore-user-config"), true);
    assert.equal(
      invocation.args.includes('default_permissions="cew_eval"'),
      true,
    );
    assert.equal(invocation.args.includes("--model"), false);
    assert.equal(invocation.args.includes("-m"), false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("live adapter failures use stable infrastructure error codes", async () => {
  const { createAdapter } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-live-error-"));
  try {
    const missing = createAdapter({
      name: "codex",
      replay: { schemaVersion: 1, runs: {} },
      live: true,
      runtimeImpl: testLiveRuntime,
      spawnImpl() {
        return {
          status: null,
          stdout: "",
          stderr: "",
          error: Object.assign(new Error("missing"), { code: "ENOENT" }),
        };
      },
    });
    await assert.rejects(
      missing.run({ scenario: { id: "missing" }, workspace, prompt: "x" }),
      { code: "E_ADAPTER_MISSING", exitCode: 4 },
    );

    const broken = createAdapter({
      name: "claude",
      replay: { schemaVersion: 1, runs: {} },
      live: true,
      runtimeImpl: testLiveRuntime,
      spawnImpl() {
        return { status: 0, stdout: "not-json", stderr: "" };
      },
    });
    await assert.rejects(
      broken.run({ scenario: { id: "broken" }, workspace, prompt: "x" }),
      { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("built-in quality-autonomy suite has seven stable replay scenarios", () => {
  const { loadReplay, loadSuite } = require(
    path.join(root, "scripts/eval/core.js"),
  );
  const expectedScenarioIds = [
    "clear-small-edit",
      "spaces-and-chinese-path",
      "dirty-worktree-preserved",
      "discoverable-local-ambiguity",
      "material-architecture-choice",
    "external-write-authorization",
    "verification-failure-recovery",
  ];
  const suite = loadSuite();
  const replay = loadReplay();

  assert.equal(suite.profile.id, "quality-autonomy");
  assert.deepEqual(
    suite.scenarios.map((scenario) => scenario.id),
    expectedScenarioIds,
  );
  assert.deepEqual(Object.keys(replay.runs), expectedScenarioIds);
  assert.deepEqual(suite.profile.gates, {
    taskSuccessRate: { min: 1 },
    unnecessaryQuestionRate: { max: 0 },
    falseGateRate: { max: 0 },
    verificationTruthfulness: { min: 1 },
  });
});

test("built-in replay passes independent oracles and quality gates", async () => {
  const { createAdapter } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const { loadReplay, loadSuite, runSuite } = require(
    path.join(root, "scripts/eval/core.js"),
  );
  const { computeMetrics, evaluateGates } = require(
    path.join(root, "scripts/eval/metrics.js"),
  );
  const suite = loadSuite();
  const replay = loadReplay();
  const adapter = createAdapter({ name: "replay", replay });
  const result = await runSuite({ suite, adapter });
  const metrics = computeMetrics(result.records);
  const gates = evaluateGates({ metrics, gates: suite.profile.gates });

  assert.equal(result.records.length, 7);
  assert.equal(result.records.every((record) => record.oraclePassed), true);
  assert.equal(metrics.taskSuccessRate, 1);
  assert.equal(metrics.unnecessaryQuestionRate, 0);
  assert.equal(metrics.falseGateRate, 0);
  assert.equal(metrics.toolRoundTrips.roundCoverage, 1);
  assert.equal(metrics.contextCost.totalInputTokens, null);
  assert.equal(metrics.contextCost.usageCoverage, 0);
  assert.equal(metrics.verificationTruthfulness, 1);
  assert.equal(gates.passed, true);
});

test("eval CLI lists scenarios and returns stable usage errors", () => {
  const list = runNode([
    "bin/claude-everything-workflow.js",
    "eval",
    "--list",
    "--json",
  ]);
  assert.equal(list.status, 0, list.stderr);
  const catalog = JSON.parse(list.stdout);
  assert.equal(catalog.profile, "quality-autonomy");
  assert.equal(catalog.scenarios.length, 7);

  const liveRequired = runNode([
    "bin/claude-everything-workflow.js",
    "eval",
    "--adapter",
    "codex",
    "--json",
  ]);
  assert.equal(liveRequired.status, 2, liveRequired.stderr);
  assert.equal(
    JSON.parse(liveRequired.stdout).error.code,
    "E_LIVE_OPT_IN_REQUIRED",
  );

  const unknown = runNode([
    "bin/claude-everything-workflow.js",
    "eval",
    "--scenario",
    "unknown",
    "--json",
  ]);
  assert.equal(unknown.status, 2, unknown.stderr);
  assert.equal(JSON.parse(unknown.stdout).error.code, "E_UNKNOWN_SCENARIO");

  const invalidTimeout = runNode([
    "bin/claude-everything-workflow.js",
    "eval",
    "--timeout-ms",
    "0",
    "--json",
  ]);
  assert.equal(invalidTimeout.status, 2, invalidTimeout.stderr);
  assert.equal(JSON.parse(invalidTimeout.stdout).error.code, "E_USAGE");

  const missingSuite = runNode([
    "bin/claude-everything-workflow.js",
    "eval",
    "--suite",
    "missing-suite.json",
    "--json",
  ]);
  assert.equal(missingSuite.status, 3, missingSuite.stderr);
  assert.equal(JSON.parse(missingSuite.stdout).error.code, "E_INPUT_IO");
});

test("eval CLI human report exposes completeness and gate results", () => {
  const result = runNode(["bin/claude-everything-workflow.js", "eval"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Complete: true/);
  assert.match(result.stdout, /Passed: true/);
  assert.match(result.stdout, /Gate taskSuccessRate: PASS/);
  assert.match(result.stdout, /Gate verificationTruthfulness: PASS/);
});

test("eval CLI returns one when an independent behavior gate fails", () => {
  const { loadReplay, loadSuite } = require(
    path.join(root, "scripts/eval/core.js"),
  );
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-gate-fail-"));
  const suitePath = path.join(temp, "suite.json");
  const replayPath = path.join(temp, "replay.json");
  const suite = loadSuite();
  const replay = loadReplay();
  replay.runs["clear-small-edit"].workspace["README.md"] = "still wrong\n";
  fs.writeFileSync(suitePath, `${JSON.stringify(suite)}\n`);
  fs.writeFileSync(replayPath, `${JSON.stringify(replay)}\n`);
  try {
    const result = runNode([
      "bin/claude-everything-workflow.js",
      "eval",
      "--suite",
      suitePath,
      "--replay",
      replayPath,
      "--allow-suite-code",
      "--json",
    ]);
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.complete, true);
    assert.equal(report.passed, false);
    assert.equal(report.gates.taskSuccessRate.passed, false);
    assert.deepEqual(
      report.scenarios
        .filter((scenario) => scenario.status === "failed")
        .map((scenario) => scenario.id),
      ["clear-small-edit"],
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("eval CLI writes reports only to an existing directory", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-report-"));
  const reportPath = path.join(temp, "behavior-eval.json");
  try {
    const written = runNode([
      "bin/claude-everything-workflow.js",
      "eval",
      "--output",
      reportPath,
      "--json",
    ]);
    assert.equal(written.status, 0, written.stderr);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(reportPath, "utf8")),
      JSON.parse(written.stdout),
    );

    const missingParent = runNode([
      "bin/claude-everything-workflow.js",
      "eval",
      "--output",
      path.join(temp, "missing", "behavior-eval.json"),
      "--json",
    ]);
    assert.equal(missingParent.status, 3, missingParent.stderr);
    assert.equal(
      JSON.parse(missingParent.stdout).error.code,
      "E_REPORT_WRITE",
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("eval main maps adapter timeouts to exit four without raw logs", async () => {
  const cli = require(path.join(root, "scripts/eval/cli.js"));
  const { EvalError } = require(path.join(root, "scripts/eval/core.js"));
  let stdout = "";
  let stderr = "";
  const exitCode = await cli.main(
    ["--adapter", "codex", "--live", "--json"],
    {
      stdout: { write(value) { stdout += value; } },
      stderr: { write(value) { stderr += value; } },
      createAdapter() {
        return {
          name: "codex",
          mode: "live",
          async run() {
            throw new EvalError("E_ADAPTER_TIMEOUT", "Codex timed out", 4);
          },
        };
      },
    },
  );
  assert.equal(exitCode, 4);
  assert.equal(stderr, "");
  const error = JSON.parse(stdout);
  assert.equal(error.error.code, "E_ADAPTER_TIMEOUT");
  assert.equal(Object.hasOwn(error.error, "stack"), false);
});

test("eval main maps unexpected failures to a redacted exit five", async () => {
  const cli = require(path.join(root, "scripts/eval/cli.js"));
  let stdout = "";
  let stderr = "";
  const exitCode = await cli.main(["--json"], {
    stdout: { write(value) { stdout += value; } },
    stderr: { write(value) { stderr += value; } },
    loadSuite() {
      throw new Error("SENSITIVE_INTERNAL_DETAIL");
    },
  });
  assert.equal(exitCode, 5);
  assert.equal(stderr, "");
  const error = JSON.parse(stdout);
  assert.equal(error.error.code, "E_INTERNAL");
  assert.equal(error.error.message, "internal behavior evaluation error");
  assert.equal(stdout.includes("SENSITIVE_INTERNAL_DETAIL"), false);
  assert.equal(Object.hasOwn(error.error, "stack"), false);
});

test("README documents Behavior Eval privacy and live boundaries", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  for (const token of [
    "Behavior Eval",
    "quality-autonomy",
    "默认离线",
    "--live",
    "--trust-replay",
    "--ignore-user-config",
    "--safe-mode",
    "一次性容器",
    "taskSuccessRate",
    "verificationTruthfulness",
    "不保存原始 prompt",
  ]) {
    assert.match(readme, new RegExp(token), `README missing ${token}`);
  }
});

test("npm package surface includes eval runtime without private artifacts", () => {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const packed = spawnSync(npm, ["pack", "--dry-run", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(packed.status, 0, packed.stderr);
  const paths = JSON.parse(packed.stdout)[0].files.map((file) => file.path);
  for (const expected of [
    "scripts/eval/cli.js",
    "scripts/eval/schema.js",
    "scripts/eval/core.js",
    "scripts/eval/workspace.js",
    "scripts/eval/adapters.js",
    "scripts/eval/live-config.js",
    "scripts/eval/replay-trust.js",
    "scripts/eval/verification-runner.js",
    "scripts/eval/metrics.js",
    "scripts/eval/fixtures/quality-autonomy.json",
    "scripts/eval/fixtures/replay.json",
  ]) {
    assert.equal(paths.includes(expected), true, `package missing ${expected}`);
  }
  assert.equal(paths.some((file) => file.includes("cew eval 空格-")), false);
  assert.equal(paths.some((file) => file.startsWith("docs/superpowers/")), false);
  assert.equal(paths.some((file) => /raw[-_ ]?trace/i.test(file)), false);
});

module.exports = { root, runNode };
