"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  EvalError,
  safeRelativePath,
  validateReplay,
  validateSuite,
} = require("./schema");
const {
  applyWorkspaceSnapshot,
  createFixture,
  resolveWorkspacePath,
  snapshotTree,
  unexpectedWorkspaceChanges,
} = require("./workspace");
const { markBuiltInReplay } = require("./replay-trust");

const DEFAULT_SUITE = path.join(__dirname, "fixtures", "quality-autonomy.json");
const DEFAULT_REPLAY = path.join(__dirname, "fixtures", "replay.json");
const BUILT_IN_SUITE = Symbol("built-in-suite");
const MAX_JSON_BYTES = 16 * 1024 * 1024;
const READ_CAPABLE_TOOLS = new Set(["read", "read_file", "readfile"]);
const WRITE_ONLY_TOOLS = new Set(["edit", "write", "apply_patch", "file_change"]);

function loadJson(file, validator) {
  let body;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) throw Object.assign(new Error("not a file"), { code: "EINVAL" });
    if (stat.size > MAX_JSON_BYTES) {
      throw new EvalError("E_SCHEMA", `JSON input exceeds ${MAX_JSON_BYTES} bytes`, 2);
    }
    body = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error instanceof EvalError) throw error;
    throw new EvalError("E_INPUT_IO", `cannot read ${file}`, 3, {
      cause: error.code,
    });
  }
  let raw;
  try {
    raw = JSON.parse(body);
  } catch {
    throw new EvalError("E_SCHEMA", `invalid JSON in ${file}`, 2);
  }
  return validator(raw);
}

function loadSuite(file = DEFAULT_SUITE) {
  const suite = loadJson(file, validateSuite);
  if (path.resolve(file) === path.resolve(DEFAULT_SUITE)) {
    Object.defineProperty(suite, BUILT_IN_SUITE, { value: true });
  }
  return suite;
}

function loadReplay(file = DEFAULT_REPLAY) {
  const replay = loadJson(file, validateReplay);
  if (path.resolve(file) === path.resolve(DEFAULT_REPLAY)) {
    markBuiltInReplay(replay);
  }
  return replay;
}

function suiteContainsCode(suite) {
  return suite.scenarios.some((scenario) => scenario.expect.verification.length > 0);
}

function authorizeSuiteCode(suite, allowSuiteCode) {
  if (!suiteContainsCode(suite) || suite[BUILT_IN_SUITE] || allowSuiteCode) return;
  throw new EvalError(
    "E_SUITE_CODE_OPT_IN_REQUIRED",
    "custom verification commands require explicit --allow-suite-code",
    2,
  );
}

function minimalOracleEnvironment() {
  const names = ["PATH", "SystemRoot", "TEMP", "TMP", "TMPDIR"];
  const env = {};
  for (const name of names) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  return env;
}

function oracleError(result, command) {
  if (!result.error && typeof result.status === "number") return null;
  if (result.error?.code === "ENOENT") {
    return new EvalError("E_ORACLE_MISSING", `${command} executable was not found`, 3);
  }
  if (result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM") {
    return new EvalError("E_ORACLE_TIMEOUT", `${command} timed out`, 3);
  }
  return new EvalError("E_ORACLE_EXEC", `${command} could not be executed`, 3, {
    cause: result.error?.code,
    status: result.status,
  });
}

function runVerification(fixture, check, inheritEnvironment) {
  const [rawCommand, ...args] = check.command;
  const command = rawCommand === "node" ? process.execPath : rawCommand;
  const result = spawnSync(command, args, {
    cwd: fixture.workspace,
    encoding: "utf8",
    env: inheritEnvironment ? process.env : minimalOracleEnvironment(),
    shell: false,
    timeout: 30000,
  });
  const infrastructure = oracleError(result, command);
  if (infrastructure) throw infrastructure;
  return {
    id: check.id,
    expectedExitCode: check.exitCode,
    actualExitCode: result.status,
    passed: result.status === check.exitCode,
  };
}

function pushFailure(failures, message) {
  if (!failures.includes(message)) failures.push(message);
}

function evaluateFileExpectations({ expectations, fixture, failures }) {
  for (const expectation of expectations) {
    const target = resolveWorkspacePath(fixture.identity, expectation.path);
    const exists = fs.existsSync(target);
    let isFile = false;
    if (exists) {
      try {
        isFile = fs.lstatSync(target).isFile();
      } catch {
        isFile = false;
      }
    }
    if (Object.hasOwn(expectation, "exists") && exists !== expectation.exists) {
      pushFailure(failures, `${expectation.path} existence did not match`);
    }
    if (expectation.exists === true && exists && !isFile) {
      pushFailure(failures, `${expectation.path} was not a regular file`);
    }
    if (!Object.hasOwn(expectation, "equals")) continue;
    if (!exists) {
      pushFailure(failures, `${expectation.path} is missing`);
      continue;
    }
    let content;
    try {
      content = isFile ? fs.readFileSync(target, "utf8") : null;
    } catch {
      content = null;
    }
    if (content !== expectation.equals) {
      pushFailure(failures, `${expectation.path} content did not match`);
    }
  }
}

function evaluateQuestions({ scenario, run, failures }) {
  const questions = run.questions || [];
  const blocking = questions.filter((question) => question.blocking);
  if (questions.some((question) => !question.blocking)) {
    pushFailure(failures, "non-blocking questions are not permitted");
  }
  const expected = scenario.expect.questions;
  if (blocking.length < expected.min || blocking.length > expected.max) {
    pushFailure(
      failures,
      `blocking questions expected ${expected.min}..${expected.max} but received ${blocking.length}`,
    );
  }
  const actualKinds = blocking.map((question) => question.kind).sort();
  const expectedKinds = [...expected.kinds].sort();
  if (JSON.stringify(actualKinds) !== JSON.stringify(expectedKinds)) {
    pushFailure(failures, "blocking question kind did not match");
  }
  return { blockingQuestions: blocking.length, questionsAsked: questions.length };
}

function toolEvents(run) {
  return (run.events || []).filter((event) => event.type === "tool_call");
}

function evaluateToolCalls({ scenario, run, failures }) {
  const count = toolEvents(run).length;
  const expected = scenario.expect.toolCalls;
  if (count < expected.min || count > expected.max) {
    pushFailure(
      failures,
      `tool calls expected ${expected.min}..${expected.max} but received ${count}`,
    );
  }
}

function successfulWorkCalls(run) {
  const results = new Set(
    (run.events || [])
      .filter(
        (event) => event.type === "tool_result" && event.purpose === "work" && event.ok,
      )
      .map((event) => event.callId),
  );
  return toolEvents(run).filter(
    (event) => event.purpose === "work" && results.has(event.callId),
  );
}

function evaluateReadBeforeWrite({ scenario, run, failures }) {
  if (scenario.expect.readBeforeWrite !== true) return;
  const calls = successfulWorkCalls(run);
  const completedReads = (run.events || []).filter(
    (event) =>
      event.type === "tool_result" &&
      event.purpose === "work" &&
      event.ok &&
      READ_CAPABLE_TOOLS.has(event.tool.toLowerCase()),
  );
  const firstWrite = calls.find((event) =>
    WRITE_ONLY_TOOLS.has(event.tool.toLowerCase()),
  );
  const completedRead = completedReads.find((event) => firstWrite && event.seq < firstWrite.seq);
  if (!firstWrite || !completedRead) {
    pushFailure(failures, "read before write requires a successful read-capable result");
  }
}

function evaluateWorkspace({ scenario, fixture, failures }) {
  const after = snapshotTree(fixture.identity);
  const allowed = scenario.expect.files.map((expectation) => expectation.path);
  for (const relative of unexpectedWorkspaceChanges(fixture.baseline, after, allowed)) {
    pushFailure(failures, `unexpected workspace change: ${relative}`);
  }
}

function successfulEvidenceForCheck(run, check, claim) {
  const evidenceIds = new Set(claim?.evidenceCallIds || []);
  return (run.events || []).filter(
    (event) =>
      event.type === "tool_result" &&
      event.purpose === "verification" &&
      event.checkId === check.id &&
      event.ok &&
      evidenceIds.has(event.callId),
  );
}

function evaluateVerificationEvidence({ requiredChecks, results, run }) {
  if (requiredChecks.length === 0) return false;
  return requiredChecks.every((check) => {
    const independent = results.find((result) => result.id === check.id);
    const claim = (run.verificationClaims || []).find(
      (candidate) => candidate.checkId === check.id && candidate.status === "passed",
    );
    return (
      independent?.passed === true &&
      claim !== undefined &&
      successfulEvidenceForCheck(run, check, claim).length > 0
    );
  });
}

function evaluateVerificationClaims({ scenario, run, failures }) {
  const known = new Map(
    scenario.expect.verification.map((check) => [check.id, check]),
  );
  const seen = new Set();
  for (const claim of run.verificationClaims || []) {
    if (!known.has(claim.checkId)) {
      pushFailure(failures, `unknown verification claim: ${claim.checkId}`);
      continue;
    }
    if (seen.has(claim.checkId)) {
      pushFailure(failures, `duplicate verification claim: ${claim.checkId}`);
      continue;
    }
    seen.add(claim.checkId);
  }
  for (const check of scenario.expect.verification) {
    if (!check.required) continue;
    const claim = (run.verificationClaims || []).find(
      (candidate) => candidate.checkId === check.id,
    );
    if (!claim) pushFailure(failures, `missing verification claim: ${check.id}`);
    else if (claim.status !== "passed") {
      pushFailure(failures, `verification claim was not passed: ${check.id}`);
    }
  }
}

function evaluateRecoveryHistory({ scenario, run, failures }) {
  for (const check of scenario.expect.verification) {
    if (!check.requireFailedAttempt) continue;
    const claim = (run.verificationClaims || []).find(
      (candidate) => candidate.checkId === check.id && candidate.status === "passed",
    );
    const successes = successfulEvidenceForCheck(run, check, claim);
    const recovered = successes.some((success) =>
      (run.events || []).some(
        (event) =>
          event.type === "tool_result" &&
          event.purpose === "verification" &&
          event.checkId === check.id &&
          !event.ok &&
          event.seq < success.seq,
      ),
    );
    if (!recovered) {
      pushFailure(failures, `verification ${check.id} needs a failed attempt before passing`);
    }
  }
}

function evaluateBehavior({ scenario, fixture, run, failures }) {
  if (run.decision !== scenario.expect.decision) {
    pushFailure(
      failures,
      `decision expected ${scenario.expect.decision} but received ${run.decision}`,
    );
  }
  const questionCounts = evaluateQuestions({ scenario, run, failures });
  evaluateToolCalls({ scenario, run, failures });
  evaluateReadBeforeWrite({ scenario, run, failures });
  evaluateFileExpectations({ expectations: scenario.expect.files, fixture, failures });
  evaluateWorkspace({ scenario, fixture, failures });
  return questionCounts;
}

async function runOracle({ scenario, fixture, run, inheritOracleEnvironment = false }) {
  const failures = [];
  const questionCounts = evaluateBehavior({ scenario, fixture, run, failures });
  evaluateVerificationClaims({ scenario, run, failures });
  evaluateRecoveryHistory({ scenario, run, failures });
  let verificationResults = scenario.expect.verification.map((check) => ({
    id: check.id,
    expectedExitCode: check.exitCode,
    actualExitCode: null,
    passed: false,
    skipped: true,
  }));

  if (failures.length === 0) {
    verificationResults = scenario.expect.verification.map((check) =>
      runVerification(fixture, check, inheritOracleEnvironment),
    );
    for (const result of verificationResults) {
      if (!result.passed) pushFailure(failures, `verification ${result.id} failed`);
    }
    evaluateFileExpectations({ expectations: scenario.expect.files, fixture, failures });
    evaluateWorkspace({ scenario, fixture, failures });
  }

  const requiredChecks = scenario.expect.verification.filter((check) => check.required);
  return {
    passed: failures.length === 0,
    failures,
    ...questionCounts,
    verificationRequired: requiredChecks.length > 0,
    verificationEvidencePassed: evaluateVerificationEvidence({
      requiredChecks,
      results: verificationResults,
      run,
    }),
    verificationResults,
  };
}

function selectScenarios(suite, selection) {
  if (selection.length === 0) return suite.scenarios;
  return selection.map((id) => {
    const scenario = suite.scenarios.find((candidate) => candidate.id === id);
    if (!scenario) {
      throw new EvalError("E_UNKNOWN_SCENARIO", `unknown scenario: ${id}`, 2);
    }
    return scenario;
  });
}

function requireAdapterCapabilities(scenarios, adapter) {
  if (adapter.capabilities?.readBeforeWriteEvidence !== false) return;
  const unsupported = scenarios.find((scenario) => scenario.expect.readBeforeWrite);
  if (!unsupported) return;
  throw new EvalError(
    "E_ADAPTER_CAPABILITY",
    `${adapter.name} cannot provide structured read-before-write evidence`,
    4,
  );
}

function buildRecord({ scenario, adapter, run, oracle }) {
  const calls = toolEvents(run);
  const roundCoverage = run.roundCoverage ?? (adapter.name === "replay" ? 1 : 0);
  const evidenceTrusted = adapter.verificationEvidenceTrusted !== false;
  return {
    id: scenario.id,
    status: oracle.passed ? "passed" : "failed",
    expectedDecision: scenario.expect.decision,
    decision: run.decision,
    adapterCompleted: true,
    oraclePassed: oracle.passed,
    blockingQuestions: oracle.blockingQuestions,
    questionsAsked: oracle.questionsAsked,
    toolRounds: roundCoverage === 1 ? calls.map((event) => event.round) : null,
    toolCalls: calls.length,
    usage: run.usage,
    verificationRequired: oracle.verificationRequired,
    verificationEvidencePassed:
      oracle.verificationEvidencePassed && evidenceTrusted,
    verificationEvidenceTrusted: evidenceTrusted,
    failures: oracle.failures,
  };
}

async function cleanupFixtures(fixtures) {
  const results = await Promise.allSettled(
    fixtures.map((fixture) => fixture.cleanup()),
  );
  const failure = results.find((result) => result.status === "rejected");
  if (!failure) return;
  if (failure.reason instanceof EvalError) throw failure.reason;
  throw new EvalError("E_FIXTURE", "cannot clean evaluation fixtures", 3);
}

async function runSuite({
  suite,
  adapter,
  selection = [],
  tempBase = os.tmpdir(),
  keepFixtures = false,
  allowSuiteCode = false,
}) {
  validateSuite(suite);
  authorizeSuiteCode(suite, allowSuiteCode);
  const selected = selectScenarios(suite, selection);
  requireAdapterCapabilities(selected, adapter);
  const records = [];
  const fixtures = [];

  try {
    for (const scenario of selected) {
      const fixture = await createFixture({ scenario, tempBase });
      fixtures.push(fixture);
      const run = await adapter.run({
        scenario,
        workspace: fixture.workspace,
        prompt: scenario.prompt,
      });
      applyWorkspaceSnapshot(fixture.identity, run.workspace);
      const oracle = await runOracle({
        scenario,
        fixture,
        run,
        inheritOracleEnvironment: allowSuiteCode,
      });
      records.push(buildRecord({ scenario, adapter, run, oracle }));
      if (!keepFixtures) await fixture.cleanup();
    }
  } catch (error) {
    try {
      await cleanupFixtures(fixtures);
    } catch {
      // 保留最先发生且可行动的根因。
    }
    throw error;
  }

  return {
    records,
    fixturePaths: keepFixtures ? fixtures.map((fixture) => fixture.workspace) : [],
    cleanup: () => cleanupFixtures(fixtures),
  };
}

module.exports = {
  DEFAULT_REPLAY,
  DEFAULT_SUITE,
  EvalError,
  createFixture,
  loadReplay,
  loadSuite,
  runOracle,
  runSuite,
  safeRelativePath,
  validateReplay,
  validateSuite,
};
