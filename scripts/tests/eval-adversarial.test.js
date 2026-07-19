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

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function profile(gates = undefined) {
  return {
    id: "adversarial-profile",
    decisionPolicy: {
      reversibleInScope: "act",
      discoverableLocalAmbiguity: "explore_then_act",
      externalOrIrreversible: "ask",
    },
    gates: gates || {
      taskSuccessRate: { min: 1 },
      unnecessaryQuestionRate: { max: 0 },
      falseGateRate: { max: 0 },
      verificationTruthfulness: { min: 1 },
    },
  };
}

function commandSuite(command, expectedContent = "ok\n", gates = undefined) {
  return {
    schemaVersion: 1,
    profile: profile(gates),
    scenarios: [
      {
        id: "custom-command",
        tags: ["adversarial"],
        prompt: "完成本地任务并验证。",
        fixture: { files: { "result.txt": "before\n" } },
        expect: {
          decision: "completed",
          questions: { min: 0, max: 0, kinds: [] },
          toolCalls: { min: 1, max: 3 },
          files: [{ path: "result.txt", equals: expectedContent }],
          verification: [
            {
              id: "custom-check",
              command,
              exitCode: 0,
              required: true,
            },
          ],
        },
      },
    ],
  };
}

function commandReplay(content = "ok\n") {
  return {
    schemaVersion: 1,
    runs: {
      "custom-command": {
        decision: "completed",
        questions: [],
        events: [
          {
            seq: 1,
            type: "tool_call",
            round: 1,
            callId: "verify-1",
            tool: "shell",
            purpose: "verification",
            checkId: "custom-check",
            ok: true,
          },
          {
            seq: 2,
            type: "tool_result",
            round: 1,
            callId: "verify-1",
            tool: "shell",
            purpose: "verification",
            checkId: "custom-check",
            ok: true,
          },
          {
            seq: 3,
            type: "final",
            round: 1,
            callId: "final",
            tool: "final",
            purpose: "final",
            ok: true,
          },
        ],
        usage: null,
        verificationClaims: [
          {
            checkId: "custom-check",
            status: "passed",
            evidenceCallIds: ["verify-1"],
          },
        ],
        workspace: { "result.txt": content },
      },
    },
  };
}

test("verification truthfulness requires the complete independent oracle", () => {
  const { computeMetrics } = require(path.join(root, "scripts/eval/metrics.js"));
  const metrics = computeMetrics([
    {
      adapterCompleted: true,
      expectedDecision: "completed",
      decision: "completed",
      oraclePassed: false,
      blockingQuestions: 0,
      toolRounds: [1],
      toolCalls: 1,
      usage: null,
      verificationRequired: true,
      verificationEvidencePassed: true,
    },
  ]);
  assert.equal(metrics.verificationTruthfulness, 0);
});

test("malicious replay cannot make the offline oracle execute workspace code", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-replay-code-"));
  const replayPath = path.join(temp, "replay.json");
  const marker = path.join(temp, "executed.txt");
  const replay = JSON.parse(
    fs.readFileSync(path.join(root, "scripts/eval/fixtures/replay.json"), "utf8"),
  );
  replay.runs["verification-failure-recovery"].workspace["calc.js"] =
    `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran');\n`;
  writeJson(replayPath, replay);
  try {
    const result = runNode([
      "scripts/eval/cli.js",
      "--replay",
      replayPath,
      "--scenario",
      "verification-failure-recovery",
      "--json",
    ]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(fs.existsSync(marker), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("custom suite commands require an explicit code-execution opt-in", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-suite-code-"));
  const suitePath = path.join(temp, "suite.json");
  const replayPath = path.join(temp, "replay.json");
  const marker = path.join(temp, "suite-command-ran.txt");
  const command = [
    "node",
    "-e",
    `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`,
  ];
  writeJson(suitePath, commandSuite(command));
  writeJson(replayPath, commandReplay());
  try {
    const denied = runNode([
      "scripts/eval/cli.js",
      "--suite",
      suitePath,
      "--replay",
      replayPath,
      "--json",
    ]);
    assert.equal(denied.status, 2, denied.stderr);
    assert.equal(JSON.parse(denied.stdout).error.code, "E_SUITE_CODE_OPT_IN_REQUIRED");
    assert.equal(fs.existsSync(marker), false);

    const allowed = runNode([
      "scripts/eval/cli.js",
      "--suite",
      suitePath,
      "--replay",
      replayPath,
      "--allow-suite-code",
      "--trust-replay",
      "--json",
    ]);
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.equal(fs.existsSync(marker), true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("fixture Git ignores redirected and signing-related host configuration", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-git-env-"));
  const outsideGit = path.join(temp, "outside.git");
  try {
    const result = runNode(["scripts/eval/cli.js", "--json"], {
      env: {
        ...process.env,
        GIT_DIR: outsideGit,
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "commit.gpgsign",
        GIT_CONFIG_VALUE_0: "true",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(outsideGit), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("fixture and replay paths reject Git control files and canonical collisions", () => {
  const { validateReplay, validateSuite } = require(
    path.join(root, "scripts/eval/schema.js"),
  );
  const suite = commandSuite(["node", "-e", "process.exit(0)"]);
  suite.scenarios[0].fixture.files = { ".git/config": "unsafe\n" };
  assert.throws(() => validateSuite(suite), { code: "E_PATH_BOUNDARY" });

  const replay = commandReplay();
  replay.runs["custom-command"].workspace = {
    "dir/file.txt": "one\n",
    "dir\\file.txt": "two\n",
  };
  assert.throws(() => validateReplay(replay), { code: "E_PATH_BOUNDARY" });

  const caseCollision = commandReplay();
  caseCollision.runs["custom-command"].workspace = {
    "Result.txt": "one\n",
    "result.txt": "two\n",
  };
  assert.throws(() => validateReplay(caseCollision), { code: "E_PATH_BOUNDARY" });

  const windowsDevice = commandReplay();
  windowsDevice.runs["custom-command"].workspace = { "CON.txt": "unsafe\n" };
  assert.throws(() => validateReplay(windowsDevice), { code: "E_PATH_BOUNDARY" });
});

test("replay evidence requires a preceding matching tool call", () => {
  const { validateReplay } = require(path.join(root, "scripts/eval/schema.js"));
  const replay = commandReplay();
  replay.runs["custom-command"].events = [
    {
      seq: 1,
      type: "tool_result",
      round: 1,
      callId: "verify-1",
      tool: "shell",
      purpose: "verification",
      ok: true,
    },
  ];
  assert.throws(() => validateReplay(replay), { code: "E_SCHEMA" });
});

test("oracle rejects extra workspace files and wrong blocking-question kinds", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const { loadReplay, loadSuite, runSuite } = require(
    path.join(root, "scripts/eval/core.js"),
  );
  const suite = loadSuite();
  const replay = loadReplay();
  replay.runs["clear-small-edit"].workspace["extra.txt"] = "unauthorized\n";
  replay.runs["material-architecture-choice"].questions[0].kind =
    "external_write_authorization";
  const adapter = createAdapter({ name: "replay", replay });
  const result = await runSuite({
    suite,
    adapter,
    selection: ["clear-small-edit", "material-architecture-choice"],
  });
  assert.equal(result.records[0].oraclePassed, false);
  assert.match(result.records[0].failures.join("\n"), /unexpected workspace change/);
  assert.equal(result.records[1].oraclePassed, false);
  assert.match(result.records[1].failures.join("\n"), /question kind/);
});

test("strict workspace delta detects empty directories but permits expected parents", async () => {
  const {
    createFixture,
    snapshotTree,
    unexpectedWorkspaceChanges,
  } = require(path.join(root, "scripts/eval/workspace.js"));
  const fixture = await createFixture({
    scenario: { id: "directory-delta", fixture: { files: {} } },
  });
  try {
    fs.mkdirSync(path.join(fixture.workspace, "extra-empty"));
    let after = snapshotTree(fixture.identity);
    assert.deepEqual(
      unexpectedWorkspaceChanges(fixture.baseline, after, []),
      ["extra-empty"],
    );

    fs.rmSync(path.join(fixture.workspace, "extra-empty"), { recursive: true });
    fs.mkdirSync(path.join(fixture.workspace, "expected-parent"));
    fs.writeFileSync(path.join(fixture.workspace, "expected-parent", "result.txt"), "ok\n");
    after = snapshotTree(fixture.identity);
    assert.deepEqual(
      unexpectedWorkspaceChanges(
        fixture.baseline,
        after,
        ["expected-parent/result.txt"],
      ),
      [],
    );
  } finally {
    await fixture.cleanup();
  }
});

test("fixture root replacement cannot redefine the trusted workspace boundary", async (t) => {
  if (!directorySymlinksAvailable(t)) return;
  const { runSuite } = require(path.join(root, "scripts/eval/core.js"));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "cew-external-root-"));
  const externalFile = path.join(external, "outside.txt");
  fs.writeFileSync(externalFile, "untouched\n");
  const suite = {
    schemaVersion: 1,
    profile: profile(),
    scenarios: [
      {
        id: "root-swap",
        tags: ["path-boundary"],
        prompt: "x",
        fixture: { files: { "inside.txt": "before\n" } },
        expect: {
          decision: "completed",
          questions: { min: 0, max: 0, kinds: [] },
          toolCalls: { min: 0, max: 0 },
          files: [{ path: "inside.txt", equals: "before\n" }],
          verification: [],
        },
      },
    ],
  };
  const adapter = {
    name: "root-swap",
    mode: "offline",
    async run({ workspace }) {
      const moved = path.join(path.dirname(workspace), "moved-workspace");
      fs.renameSync(workspace, moved);
      fs.symlinkSync(external, workspace, "dir");
      return {
        decision: "completed",
        questions: [],
        events: [],
        usage: null,
        verificationClaims: [],
        workspace: { "outside.txt": "changed\n" },
      };
    },
  };
  try {
    await assert.rejects(() => runSuite({ suite, adapter }), {
      code: "E_PATH_BOUNDARY",
    });
    assert.equal(fs.readFileSync(externalFile, "utf8"), "untouched\n");
  } finally {
    fs.rmSync(external, { recursive: true, force: true });
  }
});

test("invalid JSON never echoes source fragments in structured errors", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-json-leak-"));
  const suitePath = path.join(temp, "suite.json");
  fs.writeFileSync(suitePath, '{"secret": TOP_SECRET_VALUE}', "utf8");
  try {
    const result = runNode([
      "scripts/eval/cli.js",
      "--suite",
      suitePath,
      "--json",
    ]);
    assert.equal(result.status, 2, result.stderr);
    assert.doesNotMatch(result.stdout, /TOP_SECRET|secret/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("live protocol validation errors map to adapter infrastructure failures", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-protocol-"));
  const adapter = createAdapter({
    name: "codex",
    replay: { schemaVersion: 1, runs: {} },
    live: true,
    runtimeImpl: testLiveRuntime,
    spawnImpl() {
      return {
        status: 0,
        stderr: "",
        stdout: [
          JSON.stringify({ type: "turn.started" }),
          JSON.stringify({
            type: "item.completed",
            item: {
              id: "final",
              type: "agent_message",
              text: JSON.stringify({
                decision: "done",
                questions: [],
                verificationClaims: [],
              }),
            },
          }),
        ].join("\n"),
      };
    },
  });
  try {
    await assert.rejects(
      () => adapter.run({ scenario: { id: "bad" }, workspace, prompt: "x" }),
      { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("replay lookup ignores Object prototype properties", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const adapter = createAdapter({
    name: "replay",
    replay: { schemaVersion: 1, runs: {} },
  });
  await assert.rejects(() => adapter.run({ scenario: { id: "toString" } }), {
    code: "E_ADAPTER_PROTOCOL",
    exitCode: 4,
  });
});

test("Claude cache creation tokens count as fresh context", () => {
  const { normalizeClaudeEvents } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const run = normalizeClaudeEvents(
    [
      {
        type: "result",
        structured_output: {
          decision: "completed",
          questions: [],
          verificationClaims: [],
        },
        usage: {
          input_tokens: 20,
          cache_creation_input_tokens: 6,
          cache_read_input_tokens: 7,
          output_tokens: 5,
        },
      },
    ].map(JSON.stringify).join("\n"),
  );
  assert.equal(run.usage.freshInputTokens, 26);
  assert.equal(run.usage.cachedInputTokens, 7);
});

test("relative eval paths use the caller working directory", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-caller-cwd-"));
  const suite = commandSuite(["node", "-e", "process.exit(0)"]);
  const bin = path.join(root, "bin/claude-everything-workflow.js");
  writeJson(path.join(temp, "suite.json"), suite);
  try {
    const listed = runNode(
      [bin, "eval", "--suite", "suite.json", "--list", "--json"],
      { cwd: temp },
    );
    assert.equal(listed.status, 0, listed.stderr);
    assert.equal(JSON.parse(listed.stdout).scenarios[0].id, "custom-command");

    const report = runNode(
      [bin, "eval", "--output", "report.json", "--json"],
      { cwd: temp },
    );
    assert.equal(report.status, 0, report.stderr);
    assert.equal(fs.existsSync(path.join(temp, "report.json")), true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("empty or permissive gates cannot turn failed scenarios green", () => {
  const { evaluateGates } = require(path.join(root, "scripts/eval/metrics.js"));
  assert.equal(evaluateGates({ metrics: {}, gates: {} }).passed, false);

  const suite = commandSuite(
    ["node", "-e", "process.exit(0)"],
    "expected\n",
    {
      taskSuccessRate: { min: 0 },
      unnecessaryQuestionRate: { max: 1 },
      falseGateRate: { max: 1 },
      verificationTruthfulness: { min: 0 },
    },
  );
  const replay = commandReplay("wrong\n");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-false-green-"));
  const suitePath = path.join(temp, "suite.json");
  const replayPath = path.join(temp, "replay.json");
  writeJson(suitePath, suite);
  writeJson(replayPath, replay);
  try {
    const result = runNode([
      "scripts/eval/cli.js",
      "--suite",
      suitePath,
      "--replay",
      replayPath,
      "--allow-suite-code",
      "--json",
    ]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).passed, false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

function liveVerificationScenario() {
  return {
    id: "live-proof",
    expect: {
      verification: [
        {
          id: "node-calc",
          command: ["node", "calc.js"],
          exitCode: 0,
          required: true,
        },
      ],
    },
  };
}

function verificationCommandFromPrompt(input) {
  const prefix = "- node-calc: ";
  const runnerLine = input.split("\n").find((line) => line.startsWith(prefix));
  return runnerLine.slice(prefix.length);
}

function liveCodexVerificationOutput(command) {
  const final = {
    decision: "completed",
    questions: [],
    verificationClaims: [{ checkId: "node-calc", status: "passed" }],
  };
  return [
    { type: "turn.started" },
    {
      type: "item.started",
      item: { id: "verify-call", type: "command_execution", command },
    },
    {
      type: "item.completed",
      item: {
        id: "verify-call",
        type: "command_execution",
        command,
        exit_code: 0,
      },
    },
    {
      type: "item.completed",
      item: { id: "final", type: "agent_message", text: JSON.stringify(final) },
    },
  ].map((event) => JSON.stringify(event)).join("\n");
}

function createLiveVerificationAdapter(createAdapter, captureInvocation) {
  return createAdapter({
    name: "codex",
    replay: { schemaVersion: 1, runs: {} },
    live: true,
    runtimeImpl: testLiveRuntime,
    spawnImpl(command, args, options) {
      captureInvocation({ command, args, options });
      const verificationCommand = verificationCommandFromPrompt(options.input);
      return {
        status: 0,
        stderr: "",
        stdout: liveCodexVerificationOutput(verificationCommand),
      };
    },
  });
}

function assertLiveCodexSecurity(invocation, workspace) {
  assert.deepEqual(
    invocation.args.slice(0, invocation.args.indexOf("exec")),
    ["--ask-for-approval", "never"],
  );
  assert.equal(invocation.args.includes("--skip-git-repo-check"), true);
  assert.equal(invocation.args.includes("--ignore-user-config"), true);
  assert.equal(invocation.args.includes("SENSITIVE_PROMPT_VALUE"), false);
  assert.match(invocation.options.input, /SENSITIVE_PROMPT_VALUE/);
  assert.equal(
    invocation.args.includes('default_permissions="cew_eval"'),
    true,
  );
  assert.equal(
    invocation.args.includes("permissions.cew_eval.network.enabled=false"),
    true,
  );
  assert.equal(
    invocation.args.some((arg) => arg.startsWith("sandbox_workspace_write.")),
    false,
  );
  assert.equal(
    invocation.args.includes('shell_environment_policy.inherit="none"'),
    true,
  );
  assert.equal(fs.existsSync(path.join(workspace, ".cew-eval-output-schema.json")), false);
}

function assertLiveVerificationEvidence(run) {
  const evidence = run.events.filter((event) => event.callId === "verify-call");
  assert.equal(evidence.length, 2);
  assert.equal(evidence.every((event) => event.purpose === "verification"), true);
  assert.equal(evidence.every((event) => event.checkId === "node-calc"), true);
  assert.deepEqual(run.verificationClaims, [
    {
      checkId: "node-calc",
      status: "passed",
      evidenceCallIds: ["verify-call"],
    },
  ]);
}

test("live Codex uses stdin, non-Git support and exact verification evidence", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-live-proof-"));
  let invocation;
  try {
    const adapter = createLiveVerificationAdapter(
      createAdapter,
      (value) => { invocation = value; },
    );
    const run = await adapter.run({
      scenario: liveVerificationScenario(),
      workspace,
      prompt: "SENSITIVE_PROMPT_VALUE",
    });
    assertLiveCodexSecurity(invocation, workspace);
    assertLiveVerificationEvidence(run);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("verification evidence rejects commands that only contain the trusted payload", () => {
  const { buildVerificationPlan, normalizeCodexEvents } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const scenario = {
    expect: {
      verification: [
        {
          id: "exact-check",
          command: ["node", "-e", "process.exit(0)"],
          exitCode: 0,
          required: true,
        },
      ],
    },
  };
  const plan = buildVerificationPlan(scenario);
  const spoofed = `echo ${plan[0].command}`;
  const final = {
    decision: "completed",
    questions: [],
    verificationClaims: [{ checkId: "exact-check", status: "passed" }],
  };
  const run = normalizeCodexEvents(
    [
      { type: "turn.started" },
      {
        type: "item.completed",
        item: {
          id: "spoofed-check",
          type: "command_execution",
          command: spoofed,
          exit_code: 0,
        },
      },
      {
        type: "item.completed",
        item: {
          id: "final",
          type: "agent_message",
          text: JSON.stringify(final),
        },
      },
    ].map(JSON.stringify).join("\n"),
    plan,
  );
  assert.deepEqual(run.verificationClaims[0].evidenceCallIds, []);
});

test("live Claude enables a fail-closed sandbox and disables side-effect surfaces", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-claude-sandbox-"));
  let invocation;
  try {
    const adapter = createAdapter({
      name: "claude",
      replay: { schemaVersion: 1, runs: {} },
      live: true,
      runtimeImpl: testLiveRuntime,
      spawnImpl(command, args, options) {
        invocation = { command, args, options };
        return {
          status: 0,
          stderr: "",
          stdout: JSON.stringify({
            type: "result",
            structured_output: {
              decision: "completed",
              questions: [],
              verificationClaims: [],
            },
          }),
        };
      },
    });
    await adapter.run({
      scenario: { id: "claude-sandbox", expect: { verification: [] } },
      workspace,
      prompt: "only edit the fixture",
    });
    const settingsIndex = invocation.args.indexOf("--settings");
    assert.notEqual(settingsIndex, -1);
    const settings = JSON.parse(invocation.args[settingsIndex + 1]);
    assert.equal(invocation.args.includes("--safe-mode"), true);
    assert.equal(invocation.args.includes("--setting-sources"), false);
    const toolsIndex = invocation.args.indexOf("--tools");
    assert.equal(invocation.args[toolsIndex + 1], "Bash");
    const allowedToolsIndex = invocation.args.indexOf("--allowedTools");
    assert.equal(invocation.args[allowedToolsIndex + 1], "Bash");
    assert.equal(settings.disableAllHooks, true);
    assert.equal(settings.disableClaudeAiConnectors, true);
    assert.equal(settings.sandbox.enabled, true);
    assert.equal(settings.sandbox.failIfUnavailable, true);
    assert.equal(settings.sandbox.allowUnsandboxedCommands, false);
    assert.equal(settings.sandbox.autoAllowBashIfSandboxed, true);
    assert.deepEqual(settings.sandbox.network.allowedDomains, []);
    assert.equal(settings.sandbox.filesystem.denyRead.includes(os.homedir()), true);
    assert.equal(settings.sandbox.filesystem.denyRead.includes(os.tmpdir()), true);
    assert.equal(settings.sandbox.filesystem.allowRead.includes(workspace), true);
    assert.equal(
      settings.sandbox.filesystem.denyWrite.includes(path.join(workspace, ".git")),
      true,
    );
    assert.equal(invocation.args.includes("--strict-mcp-config"), true);
    const mcpIndex = invocation.args.indexOf("--mcp-config");
    assert.deepEqual(JSON.parse(invocation.args[mcpIndex + 1]), { mcpServers: {} });
    assert.equal(invocation.args.includes("--disable-slash-commands"), true);
    assert.equal(invocation.args.includes("--model"), false);
    assert.equal(invocation.options.shell, false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("Codex counts file changes but does not invent unavailable round data", () => {
  const { normalizeCodexEvents } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const final = {
    decision: "completed",
    questions: [],
    verificationClaims: [],
  };
  const run = normalizeCodexEvents(
    [
      { type: "turn.started" },
      {
        type: "item.completed",
        item: { id: "change-1", type: "file_change", status: "completed" },
      },
      {
        type: "item.completed",
        item: {
          id: "final",
          type: "agent_message",
          text: JSON.stringify(final),
        },
      },
    ].map(JSON.stringify).join("\n"),
  );
  assert.equal(run.events.filter((event) => event.type === "tool_call").length, 1);
  assert.equal(run.roundCoverage, 0);
});

test("oracle command infrastructure failures stay out of behavior scores", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const { runSuite } = require(path.join(root, "scripts/eval/core.js"));
  const suite = commandSuite(["cew-command-that-does-not-exist"]);
  const replay = commandReplay();
  const adapter = createAdapter({ name: "replay", replay });
  await assert.rejects(
    () => runSuite({ suite, adapter, allowSuiteCode: true }),
    { code: "E_ORACLE_MISSING", exitCode: 3 },
  );
});

test("keep-fixtures cleans every fixture when a later adapter call fails", async () => {
  const { loadSuite, runSuite } = require(path.join(root, "scripts/eval/core.js"));
  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), "cew-keep-error-"));
  let calls = 0;
  const adapter = {
    name: "failing",
    mode: "offline",
    async run() {
      calls += 1;
      if (calls === 2) throw new Error("adapter failed");
      return {
        decision: "completed",
        questions: [],
        events: [],
        usage: null,
        verificationClaims: [],
        workspace: {},
      };
    },
  };
  try {
    await assert.rejects(
      () => runSuite({
        suite: loadSuite(),
        adapter,
        selection: ["material-architecture-choice", "external-write-authorization"],
        tempBase,
        keepFixtures: true,
      }),
      /adapter failed/,
    );
    assert.deepEqual(fs.readdirSync(tempBase), []);
  } finally {
    fs.rmSync(tempBase, { recursive: true, force: true });
  }
});

test("keep-fixtures reports an inspectable path on a successful run", () => {
  let fixtureRoot;
  try {
    const result = runNode([
      "scripts/eval/cli.js",
      "--scenario",
      "clear-small-edit",
      "--keep-fixtures",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const match = result.stdout.match(/^Fixture: (.+)$/m);
    assert.ok(match, result.stdout);
    const fixture = match[1];
    fixtureRoot = path.dirname(fixture);
    assert.equal(path.basename(fixture), "工作区 space");
    assert.match(path.basename(fixtureRoot), /^cew eval 空格-/);
    assert.equal(fs.existsSync(path.join(fixture, "README.md")), true);
  } finally {
    if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("keep-fixtures preserves a completed behavior failure for inspection", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const { loadReplay, loadSuite, runSuite } = require(
    path.join(root, "scripts/eval/core.js"),
  );
  const scenarioId = "material-architecture-choice";
  const replay = loadReplay();
  replay.runs[scenarioId].decision = "completed";
  replay.runs[scenarioId].questions = [];
  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), "cew-keep-failed-"));
  try {
    const result = await runSuite({
      suite: loadSuite(),
      adapter: createAdapter({ name: "replay", replay }),
      selection: [scenarioId],
      tempBase,
      keepFixtures: true,
    });
    assert.equal(result.records[0].status, "failed");
    assert.equal(result.fixturePaths.length, 1);
    assert.equal(fs.existsSync(result.fixturePaths[0]), true);
  } finally {
    fs.rmSync(tempBase, { recursive: true, force: true });
  }
});

test("report write failures clean fixtures requested for inspection", async () => {
  const cli = require(path.join(root, "scripts/eval/cli.js"));
  const core = require(path.join(root, "scripts/eval/core.js"));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-report-cleanup-"));
  let fixturePath;
  let stdout = "";
  try {
    const exitCode = await cli.main([
      "--scenario", "clear-small-edit",
      "--keep-fixtures",
      "--output", path.join(temp, "missing", "report.json"),
      "--json",
    ], {
      stdout: { write(value) { stdout += value; } },
      async runSuite(options) {
        const result = await core.runSuite(options);
        [fixturePath] = result.fixturePaths;
        return result;
      },
    });
    assert.equal(exitCode, 3);
    assert.equal(JSON.parse(stdout).error.code, "E_REPORT_WRITE");
    assert.ok(fixturePath);
    assert.equal(fs.existsSync(fixturePath), false);
  } finally {
    if (fixturePath) fs.rmSync(path.dirname(fixturePath), { recursive: true, force: true });
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("rate gates reject missing, inverted and out-of-range thresholds", () => {
  const { validateSuite } = require(path.join(root, "scripts/eval/schema.js"));
  const missing = commandSuite(["node", "-e", "process.exit(0)"]);
  delete missing.profile.gates.taskSuccessRate;
  assert.throws(() => validateSuite(missing), { code: "E_SCHEMA" });

  const inverted = commandSuite(["node", "-e", "process.exit(0)"]);
  inverted.profile.gates.taskSuccessRate = { min: 0.9, max: 0.1 };
  assert.throws(() => validateSuite(inverted), { code: "E_SCHEMA" });

  const outside = commandSuite(["node", "-e", "process.exit(0)"]);
  outside.profile.gates.falseGateRate = { max: 2 };
  assert.throws(() => validateSuite(outside), { code: "E_SCHEMA" });
});
