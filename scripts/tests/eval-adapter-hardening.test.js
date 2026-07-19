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

function assertMinimalHostEnvironment(invocation, workspace) {
  assert.equal(path.isAbsolute(invocation.command), true);
  assert.equal(invocation.command.startsWith(`${workspace}${path.sep}`), false);
  for (const name of ["BASH_ENV", "DYLD_INSERT_LIBRARIES", "LD_PRELOAD", "NODE_OPTIONS"]) {
    assert.equal(invocation.options.env[name], undefined);
  }
}

function codexFinalOutput(final = undefined) {
  const value = final || {
    decision: "completed",
    questions: [],
    verificationClaims: [],
  };
  return [
    { type: "turn.started" },
    {
      type: "item.completed",
      item: {
        id: "final",
        type: "agent_message",
        text: JSON.stringify(value),
      },
    },
  ].map(JSON.stringify).join("\n");
}

function exactVerificationScenario() {
  return {
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
}

function passedVerificationFinal() {
  return {
    decision: "completed",
    questions: [],
    verificationClaims: [{ checkId: "exact-check", status: "passed" }],
  };
}

test("Codex live ignores user config and selects a least-privilege profile", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-codex-hardening-"));
  let invocation;
  try {
    const adapter = createAdapter({
      name: "codex",
      replay: { schemaVersion: 1, runs: {} },
      live: true,
      runtimeImpl: testLiveRuntime,
      spawnImpl(command, args, options) {
        invocation = { command, args, options };
        return { status: 0, stdout: codexFinalOutput(), stderr: "" };
      },
    });
    await adapter.run({
      scenario: { id: "codex-hardening", expect: { verification: [] } },
      workspace,
      prompt: "edit the fixture",
    });

    assertMinimalHostEnvironment(invocation, workspace);
    assert.equal(invocation.args.includes("--ignore-user-config"), true);
    assert.deepEqual(
      invocation.args.slice(0, invocation.args.indexOf("exec")),
      ["--ask-for-approval", "never"],
    );
    assert.equal(
      invocation.args.includes('default_permissions="cew_eval"'),
      true,
    );
    assert.equal(
      invocation.args.includes('permissions.cew_eval.extends=":read-only"'),
      true,
    );
    const filesystem = invocation.args.find((arg) =>
      arg.startsWith("permissions.cew_eval.filesystem="));
    assert.match(filesystem, /:workspace_roots/);
    assert.match(filesystem, /"\.git"="read"/);
    assert.match(filesystem, /="deny"/);
    assert.match(filesystem, /="read"/);
    assert.equal(
      invocation.args.includes("permissions.cew_eval.network.enabled=false"),
      true,
    );
    assert.equal(
      invocation.args.some((arg) => arg.startsWith("sandbox_workspace_write.")),
      false,
    );
    assert.equal(invocation.args.includes("mcp_servers={}"), true);
    assert.equal(
      filesystem.includes(`${JSON.stringify(os.homedir())}="deny"`),
      true,
    );
    assert.equal(
      filesystem.includes(`${JSON.stringify(os.tmpdir())}="deny"`),
      true,
    );
    assert.match(filesystem, /":slash_tmp"="deny"/);
    assert.match(filesystem, /":tmpdir"="deny"/);
    assert.equal(
      invocation.args.includes('shell_environment_policy.inherit="none"'),
      true,
    );
    const shellSet = invocation.args.find((arg) =>
      arg.startsWith("shell_environment_policy.set="));
    assert.match(shellSet, /"PATH"=/);
    assert.match(shellSet, new RegExp(path.dirname(process.execPath)));
    assert.doesNotMatch(shellSet, /HOME|SSH_AUTH_SOCK|TOKEN|SECRET|PASSWORD/);
    assert.equal(invocation.args.includes("--model"), false);
    assert.equal(invocation.args.includes("-m"), false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("Codex Windows PATH ignores injected SystemRoot environment values", () => {
  const { codexShellEnvironment } = require(
    path.join(root, "scripts/eval/live-config.js"),
  );
  const config = codexShellEnvironment({
    source: {
      SystemRoot: "C:\\attacker",
      WINDIR: "C:\\also-attacker",
      HOME: "C:\\secret-home",
      LANG: "C.UTF-8",
    },
    platform: "win32",
    executable: "D:\\trusted-node\\node.exe",
    delimiter: ";",
  });

  assert.equal(config.includes("attacker"), false);
  assert.equal(config.includes("secret-home"), false);
  assert.equal(
    config.includes(JSON.stringify("D:\\trusted-node;D:\\Windows\\System32")),
    true,
  );
});

function assertClaudeLiveSecurity(invocation, workspace) {
  assertMinimalHostEnvironment(invocation, workspace);
  assert.equal(invocation.args.includes("--safe-mode"), true);
  assert.equal(invocation.args.includes("--setting-sources"), false);
  const toolsIndex = invocation.args.indexOf("--tools");
  assert.equal(invocation.args[toolsIndex + 1], "Bash");
  const allowedToolsIndex = invocation.args.indexOf("--allowedTools");
  assert.equal(invocation.args[allowedToolsIndex + 1], "Bash");
  const permissionModeIndex = invocation.args.indexOf("--permission-mode");
  assert.equal(invocation.args[permissionModeIndex + 1], "dontAsk");
  assert.equal(invocation.options.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB, undefined);
  const settingsIndex = invocation.args.indexOf("--settings");
  const settings = JSON.parse(invocation.args[settingsIndex + 1]);
  assert.equal(settings.sandbox.autoAllowBashIfSandboxed, true);
  const deniedRoots = [
    os.homedir(),
    os.tmpdir(),
    "/var/run",
    "/run",
    "/private/var/run",
    "/tmp",
    "/private/tmp",
    "/var/tmp",
    "/private/var/tmp",
  ];
  assert.equal(
    deniedRoots.every((rootPath) =>
      settings.sandbox.filesystem.denyRead.includes(rootPath)),
    true,
  );
  assert.equal(settings.sandbox.filesystem.denyWrite.includes(os.tmpdir()), false);
  assert.equal(settings.sandbox.filesystem.allowRead.includes(workspace), true);
  assert.equal(settings.sandbox.filesystem.allowWrite.includes(workspace), true);
  assert.equal(
    settings.sandbox.filesystem.denyWrite.includes(path.join(workspace, ".git")),
    true,
  );
  assert.equal(settings.permissions.deny.includes("Edit(.git/**)"), true);
  assert.equal(
    settings.sandbox.credentials.envVars.some(
      (entry) => entry.name === "ANTHROPIC_CUSTOM_HEADERS",
    ),
    true,
  );
  assert.equal(
    settings.sandbox.credentials.files.some(
      (entry) => entry.path === process.env.CLAUDE_CONFIG_DIR,
    ),
    true,
  );
  assert.equal(invocation.options.env.CEW_UNRELATED_SECRET, undefined);
  assert.equal(
    invocation.options.env.ANTHROPIC_CUSTOM_HEADERS,
    "Authorization: sensitive",
  );
  const pathEntries = invocation.options.env.PATH.split(path.delimiter);
  assert.equal(pathEntries.length > 0, true);
  assert.equal(pathEntries.every((entry) => path.isAbsolute(entry)), true);
  assert.equal(new Set(pathEntries).size, pathEntries.length);
  const sessionTemp = invocation.options.env.TMPDIR;
  assert.equal(invocation.options.env.TMP, sessionTemp);
  assert.equal(invocation.options.env.TEMP, sessionTemp);
  assert.equal(invocation.options.env.CLAUDE_CODE_TMPDIR, sessionTemp);
  assert.equal(path.relative(workspace, sessionTemp).startsWith(".."), true);
  assert.match(path.basename(sessionTemp), /^cew-/);
  assert.equal(settings.sandbox.filesystem.allowRead.includes(sessionTemp), true);
  assert.equal(settings.sandbox.filesystem.allowWrite.includes(sessionTemp), true);
  assert.equal(fs.existsSync(sessionTemp), false);
}

test("Claude live uses safe mode, scoped tools and a minimal environment", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-claude-hardening-"));
  const previous = process.env.CEW_UNRELATED_SECRET;
  const previousHeaders = process.env.ANTHROPIC_CUSTOM_HEADERS;
  const previousConfigDir = process.env.CLAUDE_CONFIG_DIR;
  process.env.CEW_UNRELATED_SECRET = "must-not-reach-claude";
  process.env.ANTHROPIC_CUSTOM_HEADERS = "Authorization: sensitive";
  process.env.CLAUDE_CONFIG_DIR = path.join(path.dirname(os.tmpdir()), "cew-config");
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
      scenario: { id: "claude-hardening", expect: { verification: [] } },
      workspace,
      prompt: "edit the fixture",
    });

    assertClaudeLiveSecurity(invocation, workspace);
  } finally {
    if (previous === undefined) delete process.env.CEW_UNRELATED_SECRET;
    else process.env.CEW_UNRELATED_SECRET = previous;
    if (previousHeaders === undefined) delete process.env.ANTHROPIC_CUSTOM_HEADERS;
    else process.env.ANTHROPIC_CUSTOM_HEADERS = previousHeaders;
    if (previousConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = previousConfigDir;
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("Claude live cleans its private session temp after host failure", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-claude-temp-"));
  let sessionTemp;
  try {
    const adapter = createAdapter({
      name: "claude",
      replay: { schemaVersion: 1, runs: {} },
      live: true,
      runtimeImpl: testLiveRuntime,
      spawnImpl(_command, _args, options) {
        sessionTemp = options.env.TMPDIR;
        return { status: 1, stderr: "failed", stdout: "" };
      },
    });
    await assert.rejects(
      adapter.run({
        scenario: { id: "claude-temp-cleanup", expect: { verification: [] } },
        workspace,
        prompt: "edit the fixture",
      }),
      (error) => error.code === "E_ADAPTER_EXIT",
    );
    assert.equal(path.relative(workspace, sessionTemp).startsWith(".."), true);
    assert.equal(fs.existsSync(sessionTemp), false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("live verification events carry their evaluator checkId", () => {
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
  const rows = [
    { type: "turn.started" },
    {
      type: "item.completed",
      item: {
        id: "check-call",
        type: "command_execution",
        command: plan[0].command,
        exit_code: 0,
      },
    },
    {
      type: "item.completed",
      item: {
        id: "final",
        type: "agent_message",
        text: JSON.stringify({
          decision: "completed",
          questions: [],
          verificationClaims: [{ checkId: "exact-check", status: "passed" }],
        }),
      },
    },
  ];
  const run = normalizeCodexEvents(rows.map(JSON.stringify).join("\n"), plan);
  const evidence = run.events.filter((event) => event.purpose === "verification");

  assert.equal(evidence.length, 2);
  assert.equal(evidence.every((event) => event.checkId === "exact-check"), true);
});

test("Claude live verification events carry their evaluator checkId", () => {
  const { buildVerificationPlan, normalizeClaudeEvents } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const plan = buildVerificationPlan({
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
  });
  const rows = [
    {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "check-call",
            name: "Bash",
            input: { command: plan[0].command },
          },
        ],
      },
    },
    {
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "check-call",
            content: "ok",
            is_error: false,
          },
        ],
      },
    },
    {
      type: "result",
      structured_output: {
        decision: "completed",
        questions: [],
        verificationClaims: [{ checkId: "exact-check", status: "passed" }],
      },
    },
  ];
  const run = normalizeClaudeEvents(rows.map(JSON.stringify).join("\n"), plan);
  const evidence = run.events.filter((event) => event.purpose === "verification");

  assert.equal(evidence.length, 2);
  assert.equal(evidence.every((event) => event.checkId === "exact-check"), true);
});

test("verification runner loads trusted source without resolving its denied parent", () => {
  const { buildVerificationPlan } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const plan = buildVerificationPlan({
    expect: {
      verification: [
        {
          id: "sandbox-check",
          command: ["node", "-e", "process.exit(0)"],
          exitCode: 0,
          required: true,
        },
      ],
    },
  });

  assert.doesNotMatch(plan[0].command, /\/bin\/sh/);
  assert.match(plan[0].command, /['"]-e['"]/);
  assert.match(plan[0].command, /new Function/);
  assert.match(plan[0].command, /['"]--payload['"]/);
});

test("verification command safely quotes POSIX and PowerShell paths", () => {
  const { runnerCommand } = require(path.join(root, "scripts/eval/adapters.js"));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-runner-quoting-"));
  const runnerPath = path.join(
    temp,
    "runner-$(printf EXPANDED)-`printf BAD`-' 中文.js",
  );
  const payload = Buffer.from(JSON.stringify({
    checkId: "quoting-check",
    command: ["node", "-e", "process.exit(0)"],
    exitCode: 0,
  })).toString("base64url");
  try {
    fs.copyFileSync(
      path.join(root, "scripts/eval/verification-runner.js"),
      runnerPath,
    );
    const posix = runnerCommand(payload, {
      platform: "darwin",
      shell: "posix",
      executable: process.execPath,
      runnerPath,
    });
    if (process.platform !== "win32") {
      const result = spawnSync("/bin/sh", ["-c", posix], {
        cwd: root,
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
    }

    const powershell = runnerCommand(payload, {
      platform: "win32",
      shell: "powershell",
      executable: "C:\\Program Files\\Node's\\node.exe",
      runnerPath: "C:\\工作区\\runner's.js",
    });
    assert.match(powershell, /^& /);
    assert.match(powershell, /Node''s/);
    assert.match(powershell, /runner''s/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("non-execution tools cannot create verification evidence", () => {
  const { buildVerificationPlan, normalizeClaudeEvents, normalizeCodexEvents } =
    require(path.join(root, "scripts/eval/adapters.js"));
  const plan = buildVerificationPlan({
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
  });
  const final = {
    decision: "completed",
    questions: [],
    verificationClaims: [{ checkId: "exact-check", status: "passed" }],
  };
  const codexRows = [
    { type: "turn.started" },
    {
      type: "item.completed",
      item: {
        id: "fake-check",
        type: "file_change",
        arguments: plan[0].command,
        status: "completed",
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
  ];
  const claudeRows = [
    {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "fake-check",
            name: "Write",
            input: { command: plan[0].command },
          },
        ],
      },
    },
    {
      type: "user",
      message: {
        content: [
          { type: "tool_result", tool_use_id: "fake-check", content: "ok" },
        ],
      },
    },
    { type: "result", structured_output: final },
  ];
  const codex = normalizeCodexEvents(
    codexRows.map(JSON.stringify).join("\n"),
    plan,
  );
  const claude = normalizeClaudeEvents(
    claudeRows.map(JSON.stringify).join("\n"),
    plan,
  );

  assert.deepEqual(codex.verificationClaims[0].evidenceCallIds, []);
  assert.deepEqual(claude.verificationClaims[0].evidenceCallIds, []);
});

test("Codex verification completion without exit_code fails closed", () => {
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
  const rows = [
    { type: "turn.started" },
    {
      type: "item.completed",
      item: {
        id: "check-call",
        type: "command_execution",
        command: plan[0].command,
        status: "completed",
      },
    },
    {
      type: "item.completed",
      item: {
        id: "final",
        type: "agent_message",
        text: JSON.stringify({
          decision: "completed",
          questions: [],
          verificationClaims: [{ checkId: "exact-check", status: "passed" }],
        }),
      },
    },
  ];

  assert.throws(
    () => normalizeCodexEvents(rows.map(JSON.stringify).join("\n"), plan),
    { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
  );
});

test("Codex completion cannot change a started command or tool", () => {
  const { buildVerificationPlan, normalizeCodexEvents } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const plan = buildVerificationPlan({
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
  });
  const completions = [
    {
      id: "check-call",
      type: "command_execution",
      command: "echo changed",
      exit_code: 0,
    },
    {
      id: "check-call",
      type: "file_change",
      command: plan[0].command,
      status: "completed",
    },
  ];
  for (const completion of completions) {
    const rows = [
      { type: "turn.started" },
      {
        type: "item.started",
        item: {
          id: "check-call",
          type: "command_execution",
          command: plan[0].command,
        },
      },
      { type: "item.completed", item: completion },
      {
        type: "item.completed",
        item: {
          id: "final",
          type: "agent_message",
          text: JSON.stringify({
            decision: "completed",
            questions: [],
            verificationClaims: [
              { checkId: "exact-check", status: "passed" },
            ],
          }),
        },
      },
    ];
    assert.throws(
      () => normalizeCodexEvents(rows.map(JSON.stringify).join("\n"), plan),
      { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
    );
  }
});

test("Codex and Claude reject duplicate tool call ids", () => {
  const { buildVerificationPlan, normalizeClaudeEvents, normalizeCodexEvents } =
    require(path.join(root, "scripts/eval/adapters.js"));
  const plan = buildVerificationPlan(exactVerificationScenario());
  const final = passedVerificationFinal();
  const codexRows = [
    { type: "turn.started" },
    {
      type: "item.started",
      item: {
        id: "duplicate",
        type: "command_execution",
        command: plan[0].command,
      },
    },
    {
      type: "item.started",
      item: {
        id: "duplicate",
        type: "command_execution",
        command: "false",
      },
    },
    {
      type: "item.completed",
      item: { id: "duplicate", type: "command_execution", exit_code: 0 },
    },
    {
      type: "item.completed",
      item: {
        id: "final",
        type: "agent_message",
        text: JSON.stringify(final),
      },
    },
  ];
  const claudeRows = [
    {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "duplicate",
            name: "Bash",
            input: { command: plan[0].command },
          },
          {
            type: "tool_use",
            id: "duplicate",
            name: "Bash",
            input: { command: "false" },
          },
        ],
      },
    },
    {
      type: "user",
      message: {
        content: [
          { type: "tool_result", tool_use_id: "duplicate", content: "ok" },
        ],
      },
    },
    { type: "result", structured_output: final },
  ];

  assert.throws(
    () => normalizeCodexEvents(codexRows.map(JSON.stringify).join("\n"), plan),
    { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
  );
  assert.throws(
    () => normalizeClaudeEvents(claudeRows.map(JSON.stringify).join("\n"), plan),
    { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
  );
});

test("Claude rejects a tool_result for an unknown tool_use_id", () => {
  const { normalizeClaudeEvents } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const rows = [
    {
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "never-started",
            content: "ok",
          },
        ],
      },
    },
    {
      type: "result",
      structured_output: {
        decision: "completed",
        questions: [],
        verificationClaims: [],
      },
    },
  ];

  assert.throws(
    () => normalizeClaudeEvents(rows.map(JSON.stringify).join("\n")),
    { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
  );
});

test("Claude error results and malformed error flags fail closed", () => {
  const { normalizeClaudeEvents } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const final = {
    decision: "completed",
    questions: [],
    verificationClaims: [],
  };
  const resultCases = [
    { type: "result", is_error: true, structured_output: final },
    {
      type: "result",
      is_error: false,
      subtype: "error_during_execution",
      structured_output: final,
    },
    {
      type: "result",
      is_error: "false",
      subtype: "success",
      structured_output: final,
    },
  ];
  for (const row of resultCases) {
    assert.throws(
      () => normalizeClaudeEvents(JSON.stringify(row)),
      { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
    );
  }

  const malformedToolResult = [
    {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "call-1",
            name: "Bash",
            input: { command: "true" },
          },
        ],
      },
    },
    {
      type: "user",
      message: {
        content: [
          { type: "tool_result", tool_use_id: "call-1", is_error: "false" },
        ],
      },
    },
    { type: "result", is_error: false, structured_output: final },
  ];
  assert.throws(
    () => normalizeClaudeEvents(malformedToolResult.map(JSON.stringify).join("\n")),
    { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
  );
});

test("Claude verification requires status and preserves failed attempts", () => {
  const { buildVerificationPlan, normalizeClaudeEvents } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const plan = buildVerificationPlan(exactVerificationScenario());
  const toolUse = (id) => ({
    type: "assistant",
    message: { content: [{
      type: "tool_use", id, name: "Bash", input: { command: plan[0].command },
    }] },
  });
  const toolResult = (id, isError) => ({
    type: "user",
    message: { content: [{
      type: "tool_result",
      tool_use_id: id,
      ...(isError === undefined ? {} : { is_error: isError }),
    }] },
  });
  const final = { type: "result", is_error: false, structured_output: passedVerificationFinal() };

  assert.throws(
    () => normalizeClaudeEvents(
      [toolUse("missing"), toolResult("missing"), final]
        .map(JSON.stringify).join("\n"),
      plan,
    ),
    { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
  );

  const run = normalizeClaudeEvents([
    toolUse("failed"),
    toolResult("failed", true),
    toolUse("passed"),
    toolResult("passed", false),
    final,
  ].map(JSON.stringify).join("\n"), plan);
  const results = run.events.filter((event) => event.type === "tool_result");
  assert.deepEqual(results.map((event) => event.ok), [false, true]);
  assert.deepEqual(run.verificationClaims[0].evidenceCallIds, ["passed"]);
});

test("live adapters reject more than one final response", () => {
  const { normalizeClaudeEvents, normalizeCodexEvents } = require(
    path.join(root, "scripts/eval/adapters.js"),
  );
  const final = passedVerificationFinal();
  final.verificationClaims = [];
  const codexRows = [
    { type: "turn.started" },
    ...["first", "second"].map((id) => ({
      type: "item.completed",
      item: { id, type: "agent_message", text: JSON.stringify(final) },
    })),
  ];
  const claudeRows = [
    { type: "result", is_error: false, structured_output: final },
    { type: "result", is_error: false, structured_output: final },
  ];

  for (const [normalize, rows] of [
    [normalizeCodexEvents, codexRows],
    [normalizeClaudeEvents, claudeRows],
  ]) {
    assert.throws(
      () => normalize(rows.map(JSON.stringify).join("\n")),
      { code: "E_ADAPTER_PROTOCOL", exitCode: 4 },
    );
  }
});

test("live prompt encodes act, explore_then_act and ask habits", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-prompt-policy-"));
  let input;
  try {
    const adapter = createAdapter({
      name: "codex",
      replay: { schemaVersion: 1, runs: {} },
      live: true,
      runtimeImpl: testLiveRuntime,
      spawnImpl(command, args, options) {
        input = options.input;
        return { status: 0, stdout: codexFinalOutput(), stderr: "" };
      },
    });
    await adapter.run({
      scenario: { id: "prompt-policy", expect: { verification: [] } },
      workspace,
      prompt: "improve the fixture",
    });

    assert.match(input, /act:.*clear.*in-scope.*reversible.*directly/i);
    assert.match(input, /explore_then_act:.*locally discoverable.*then act/i);
    assert.match(input, /ask:.*architecture.*external write.*irreversible.*authorization/i);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("adapter exposes an explicit verification evidence trust boundary", () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const { markBuiltInReplay } = require(
    path.join(root, "scripts/eval/replay-trust.js"),
  );
  const untrusted = { schemaVersion: 1, runs: {} };
  const builtIn = markBuiltInReplay({ schemaVersion: 1, runs: {} });

  assert.equal(
    createAdapter({ name: "replay", replay: untrusted })
      .verificationEvidenceTrusted,
    false,
  );
  assert.equal(
    createAdapter({ name: "replay", replay: untrusted, trustReplay: true })
      .verificationEvidenceTrusted,
    true,
  );
  assert.equal(
    createAdapter({ name: "replay", replay: untrusted, trustReplay: "true" })
      .verificationEvidenceTrusted,
    false,
  );
  assert.equal(
    createAdapter({ name: "replay", replay: builtIn })
      .verificationEvidenceTrusted,
    true,
  );
  assert.equal(
    createAdapter({ name: "replay", replay: builtIn })
      .capabilities.readBeforeWriteEvidence,
    true,
  );
  for (const name of ["codex", "claude"]) {
    const adapter = createAdapter({ name, replay: untrusted, live: true });
    assert.equal(adapter.verificationEvidenceTrusted, true);
    assert.equal(adapter.capabilities.readBeforeWriteEvidence, false);
  }
});
