"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const corePath = path.join(root, "scripts/eval/core.js");
const schemaPath = path.join(root, "scripts/eval/schema.js");

function gates() {
  return {
    taskSuccessRate: { min: 1 },
    unnecessaryQuestionRate: { max: 0 },
    falseGateRate: { max: 0 },
    verificationTruthfulness: { min: 1 },
  };
}

function scenario(overrides = {}) {
  return {
    id: "hardening-case",
    tags: ["adversarial"],
    prompt: "完成明确的本地任务。",
    fixture: { files: { "result.txt": "ok\n" } },
    expect: {
      decision: "completed",
      questions: { min: 0, max: 0, kinds: [] },
      toolCalls: { min: 0, max: 0 },
      files: [{ path: "result.txt", equals: "ok\n" }],
      verification: [],
    },
    ...overrides,
  };
}

function suite(oneScenario = scenario()) {
  return {
    schemaVersion: 1,
    profile: {
      id: "hardening-profile",
      decisionPolicy: {
        reversibleInScope: "act",
        discoverableLocalAmbiguity: "explore_then_act",
        externalOrIrreversible: "ask",
      },
      gates: gates(),
    },
    scenarios: [oneScenario],
  };
}

function finalEvent(seq = 1, round = 0) {
  return {
    seq,
    type: "final",
    round,
    callId: "final",
    tool: "final",
    purpose: "final",
    ok: true,
  };
}

function replayRun(events) {
  return {
    decision: "completed",
    questions: [],
    events,
    usage: null,
    verificationClaims: [],
    workspace: {},
  };
}

test("fixture file maps reject cross-map portable path collisions", () => {
  const { validateSuite } = require(schemaPath);
  const value = suite();
  value.scenarios[0].fixture = {
    files: { "A.txt": "plain\n" },
    git: {
      committedFiles: { "a.txt": "base\n" },
      dirtyFiles: {},
    },
  };
  assert.throws(() => validateSuite(value), { code: "E_PATH_BOUNDARY" });

  value.scenarios[0].fixture = {
    files: {},
    git: {
      committedFiles: { "A.txt": "base\n" },
      dirtyFiles: { "a.txt": "dirty\n" },
    },
  };
  assert.throws(() => validateSuite(value), { code: "E_PATH_BOUNDARY" });

  value.scenarios[0].fixture.git.dirtyFiles = { "A.txt": "dirty\n" };
  assert.doesNotThrow(() => validateSuite(value));
});

test("replay protocol requires one final event and a result for every call", () => {
  const { validateReplay } = require(schemaPath);
  const call = {
    seq: 1,
    type: "tool_call",
    round: 1,
    callId: "read-1",
    tool: "Read",
    purpose: "work",
    ok: true,
  };
  const raw = { schemaVersion: 1, runs: { "hardening-case": replayRun([]) } };
  assert.throws(() => validateReplay(raw), { code: "E_SCHEMA" });

  raw.runs["hardening-case"].events = [call, finalEvent(2, 1)];
  assert.throws(() => validateReplay(raw), { code: "E_SCHEMA" });

  raw.runs["hardening-case"].events = [finalEvent(), finalEvent(2)];
  assert.throws(() => validateReplay(raw), { code: "E_SCHEMA" });
});

test("verification events require a matching checkId", () => {
  const { validateReplay } = require(schemaPath);
  const events = [
    {
      seq: 1,
      type: "tool_call",
      round: 1,
      callId: "verify-1",
      tool: "Bash",
      purpose: "verification",
      checkId: "expected-check",
      ok: true,
    },
    {
      seq: 2,
      type: "tool_result",
      round: 1,
      callId: "verify-1",
      tool: "Bash",
      purpose: "verification",
      checkId: "different-check",
      ok: true,
    },
    finalEvent(3, 1),
  ];
  const raw = { schemaVersion: 1, runs: { "hardening-case": replayRun(events) } };
  assert.throws(() => validateReplay(raw), { code: "E_SCHEMA" });
});

test("non-blocking questions cannot bypass the autonomy oracle", async () => {
  const { runSuite } = require(corePath);
  const adapter = {
    name: "direct",
    mode: "offline",
    async run() {
      return {
        decision: "completed",
        questions: [{ blocking: false, kind: "other", reason: "顺便确认一下。" }],
        events: [finalEvent()],
        usage: null,
        verificationClaims: [],
        workspace: {},
      };
    },
  };
  const result = await runSuite({ suite: suite(), adapter });
  assert.equal(result.records[0].oraclePassed, false);
  assert.equal(result.records[0].questionsAsked, 1);
  assert.match(result.records[0].failures.join("\n"), /non-blocking question/);
});

test("exists true requires a regular file instead of a directory", async () => {
  const { runSuite } = require(corePath);
  const value = scenario();
  value.fixture.files = {};
  value.expect.files = [{ path: "output.txt", exists: true }];
  const adapter = {
    name: "direct",
    mode: "offline",
    async run({ workspace }) {
      fs.mkdirSync(path.join(workspace, "output.txt"));
      return {
        decision: "completed",
        questions: [],
        events: [finalEvent()],
        usage: null,
        verificationClaims: [],
        workspace: {},
      };
    },
  };

  const result = await runSuite({ suite: suite(value), adapter });
  assert.equal(result.records[0].oraclePassed, false);
  assert.match(result.records[0].failures.join("\n"), /regular file/);
});

function recoveryScenario() {
  const value = scenario();
  value.expect.verification = [
    {
      id: "result-check",
      command: ["node", "-e", "process.exit(0)"],
      exitCode: 0,
      required: true,
      requireFailedAttempt: true,
    },
  ];
  value.expect.toolCalls = { min: 1, max: 3 };
  return value;
}

function verificationEvents(includeFailure) {
  const events = [];
  let seq = 1;
  if (includeFailure) {
    events.push(
      {
        seq: seq++, type: "tool_call", round: 1, callId: "failed-1",
        tool: "Bash", purpose: "verification", checkId: "result-check", ok: true,
      },
      {
        seq: seq++, type: "tool_result", round: 1, callId: "failed-1",
        tool: "Bash", purpose: "verification", checkId: "result-check", ok: false,
      },
    );
  }
  events.push(
    {
      seq: seq++, type: "tool_call", round: 2, callId: "passed-1",
      tool: "Bash", purpose: "verification", checkId: "result-check", ok: true,
    },
    {
      seq: seq++, type: "tool_result", round: 2, callId: "passed-1",
      tool: "Bash", purpose: "verification", checkId: "result-check", ok: true,
    },
    finalEvent(seq, 2),
  );
  return events;
}

async function runRecovery(includeFailure) {
  const { createFixture, runOracle } = require(corePath);
  const current = recoveryScenario();
  const fixture = await createFixture({ scenario: current });
  try {
    return await runOracle({
      scenario: current,
      fixture,
      run: {
        decision: "completed",
        questions: [],
        events: verificationEvents(includeFailure),
        verificationClaims: [
          {
            checkId: "result-check",
            status: "passed",
            evidenceCallIds: ["passed-1"],
          },
        ],
      },
    });
  } finally {
    await fixture.cleanup();
  }
}

test("recovery expectations require a failed check before the successful retry", async () => {
  const withoutFailure = await runRecovery(false);
  assert.equal(withoutFailure.passed, false);
  assert.match(withoutFailure.failures.join("\n"), /failed attempt/);

  const recovered = await runRecovery(true);
  assert.equal(recovered.passed, true);
  assert.equal(recovered.verificationEvidencePassed, true);
});

test("oracle rejects unknown and duplicate verification claims", async () => {
  const { createFixture, runOracle } = require(corePath);
  const current = recoveryScenario();
  current.expect.verification[0].requireFailedAttempt = false;
  const fixture = await createFixture({ scenario: current });
  const base = {
    decision: "completed",
    questions: [],
    events: verificationEvents(false),
  };
  try {
    const unknown = await runOracle({
      scenario: current,
      fixture,
      run: {
        ...base,
        verificationClaims: [
          { checkId: "unknown", status: "passed", evidenceCallIds: ["passed-1"] },
        ],
      },
    });
    assert.equal(unknown.passed, false);
    assert.match(unknown.failures.join("\n"), /unknown verification claim/);

    const claim = {
      checkId: "result-check",
      status: "passed",
      evidenceCallIds: ["passed-1"],
    };
    const duplicate = await runOracle({
      scenario: current,
      fixture,
      run: { ...base, verificationClaims: [claim, { ...claim }] },
    });
    assert.equal(duplicate.passed, false);
    assert.match(duplicate.failures.join("\n"), /duplicate verification claim/);
  } finally {
    await fixture.cleanup();
  }
});

test("the default suite covers discoverable local ambiguity", () => {
  const { loadSuite, validateSuite } = require(corePath);
  const current = loadSuite();
  const localAmbiguity = current.scenarios.find(
    (entry) => entry.id === "discoverable-local-ambiguity",
  );
  assert.equal(localAmbiguity.expect.readBeforeWrite, true);
  localAmbiguity.expect.readBeforeWrite = "yes";
  assert.throws(() => validateSuite(current), { code: "E_SCHEMA" });
});

test("the recovery scenario requests the same controlled check before and after", () => {
  const { loadSuite } = require(corePath);
  const recovery = loadSuite().scenarios.find(
    (entry) => entry.id === "verification-failure-recovery",
  );
  assert.match(recovery.prompt, /node-calc/);
  assert.match(recovery.prompt, /先.*失败.*修复.*重新运行/);
  assert.equal(recovery.expect.verification[0].requireFailedAttempt, true);
});

test("local ambiguity oracle rejects writing and verification without prior reading", async () => {
  const { loadSuite, runSuite } = require(corePath);
  const current = loadSuite();
  const adapter = {
    name: "direct",
    mode: "offline",
    async run() {
      return {
        decision: "completed",
        questions: [],
        events: [
          {
            seq: 1, type: "tool_call", round: 1, callId: "edit-1",
            tool: "Edit", purpose: "work", ok: true,
          },
          {
            seq: 2, type: "tool_result", round: 1, callId: "edit-1",
            tool: "Edit", purpose: "work", ok: true,
          },
          {
            seq: 3, type: "tool_call", round: 2, callId: "verify-1",
            tool: "Bash", purpose: "verification", checkId: "local-mode-check", ok: true,
          },
          {
            seq: 4, type: "tool_result", round: 2, callId: "verify-1",
            tool: "Bash", purpose: "verification", checkId: "local-mode-check", ok: true,
          },
          finalEvent(5, 2),
        ],
        usage: null,
        verificationClaims: [
          {
            checkId: "local-mode-check",
            status: "passed",
            evidenceCallIds: ["verify-1"],
          },
        ],
        workspace: { "config.txt": "mode=local\n" },
      };
    },
  };

  const result = await runSuite({
    suite: current,
    adapter,
    selection: ["discoverable-local-ambiguity"],
  });
  assert.equal(result.records[0].oraclePassed, false);
  assert.match(result.records[0].failures.join("\n"), /read before write/);
});

test("ambiguous Bash followed by Edit cannot spoof read-before-write evidence", async () => {
  const { loadSuite, runSuite } = require(corePath);
  const adapter = {
    name: "direct",
    mode: "offline",
    async run() {
      return {
        decision: "completed",
        questions: [],
        events: [
          {
            seq: 1, type: "tool_call", round: 1, callId: "bash-write-a",
            tool: "Bash", purpose: "work", ok: true,
          },
          {
            seq: 2, type: "tool_result", round: 1, callId: "bash-write-a",
            tool: "Bash", purpose: "work", ok: true,
          },
          {
            seq: 3, type: "tool_call", round: 2, callId: "edit-noop",
            tool: "Edit", purpose: "work", ok: true,
          },
          {
            seq: 4, type: "tool_result", round: 2, callId: "edit-noop",
            tool: "Edit", purpose: "work", ok: true,
          },
          {
            seq: 5, type: "tool_call", round: 3, callId: "verify-2",
            tool: "Bash", purpose: "verification", checkId: "local-mode-check", ok: true,
          },
          {
            seq: 6, type: "tool_result", round: 3, callId: "verify-2",
            tool: "Bash", purpose: "verification", checkId: "local-mode-check", ok: true,
          },
          finalEvent(7, 3),
        ],
        usage: null,
        verificationClaims: [
          {
            checkId: "local-mode-check",
            status: "passed",
            evidenceCallIds: ["verify-2"],
          },
        ],
        workspace: { "config.txt": "mode=local\n" },
      };
    },
  };
  const result = await runSuite({
    suite: loadSuite(),
    adapter,
    selection: ["discoverable-local-ambiguity"],
  });
  assert.equal(result.records[0].oraclePassed, false);
  assert.match(result.records[0].failures.join("\n"), /read before write/);
});

test("missing structured read evidence is an adapter capability error", async () => {
  const { loadSuite, runSuite } = require(corePath);
  let calls = 0;
  const adapter = {
    name: "codex",
    mode: "live",
    capabilities: { readBeforeWriteEvidence: false },
    async run() {
      calls += 1;
      throw new Error("must not start");
    },
  };

  await assert.rejects(
    () => runSuite({
      suite: loadSuite(),
      adapter,
      selection: ["discoverable-local-ambiguity"],
    }),
    { code: "E_ADAPTER_CAPABILITY", exitCode: 4 },
  );
  assert.equal(calls, 0);
});

test("suite schema rejects unbounded file maps", () => {
  const { validateSuite } = require(schemaPath);
  const value = suite();
  value.scenarios[0].fixture.files = Object.fromEntries(
    Array.from({ length: 1001 }, (_, index) => [`file-${index}.txt`, "x"]),
  );
  assert.throws(() => validateSuite(value), { code: "E_SCHEMA" });
});

test("custom replay verification evidence needs an explicit trust decision", async () => {
  const { createAdapter } = require(path.join(root, "scripts/eval/adapters.js"));
  const { loadSuite, runSuite } = require(corePath);
  const replay = JSON.parse(
    fs.readFileSync(path.join(root, "scripts/eval/fixtures/replay.json"), "utf8"),
  );
  const current = loadSuite();
  const untrusted = await runSuite({
    suite: current,
    adapter: createAdapter({ name: "replay", replay }),
    selection: ["clear-small-edit"],
  });
  assert.equal(untrusted.records[0].oraclePassed, true);
  assert.equal(untrusted.records[0].verificationEvidencePassed, false);
  assert.equal(untrusted.records[0].verificationEvidenceTrusted, false);

  const trusted = await runSuite({
    suite: current,
    adapter: createAdapter({ name: "replay", replay, trustReplay: true }),
    selection: ["clear-small-edit"],
  });
  assert.equal(trusted.records[0].verificationEvidencePassed, true);
  assert.equal(trusted.records[0].verificationEvidenceTrusted, true);
});
