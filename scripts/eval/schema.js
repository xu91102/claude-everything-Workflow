"use strict";

const path = require("node:path");

const DECISIONS = new Set(["completed", "needs_input", "blocked"]);
const GATE_NAMES = new Set([
  "taskSuccessRate",
  "unnecessaryQuestionRate",
  "falseGateRate",
  "verificationTruthfulness",
]);
const QUESTION_KINDS = new Set([
  "architecture_direction",
  "external_write_authorization",
  "other",
]);
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const MAX_FILE_ENTRIES = 1000;
const MAX_FILE_CONTENT_BYTES = 1024 * 1024;
const MAX_TOTAL_FILE_CONTENT_BYTES = 10 * 1024 * 1024;
const MAX_SCENARIOS = 100;
const MAX_REPLAY_EVENTS = 10000;

class EvalError extends Error {
  constructor(code, message, exitCode, details = undefined) {
    super(message);
    this.name = "EvalError";
    this.code = code;
    this.exitCode = exitCode;
    if (details !== undefined) this.details = details;
  }
}

function schemaError(message, details) {
  throw new EvalError("E_SCHEMA", message, 2, details);
}

function expectObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    schemaError(`${label} must be an object`);
  }
}

function expectArray(value, label) {
  if (!Array.isArray(value)) schemaError(`${label} must be an array`);
}

function expectString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    schemaError(`${label} must be a non-empty string`);
  }
}

function expectIdentifier(value, label) {
  expectString(value, label);
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(value)) {
    schemaError(`${label} must be a lowercase stable identifier`);
  }
}

function expectFiniteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    schemaError(`${label} must be a finite number`);
  }
}

function checkKeys(value, allowed, required, label) {
  expectObject(value, label);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) schemaError(`${label}.${key} is not allowed`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) schemaError(`${label}.${key} is required`);
  }
}

function safeRelativePath(value) {
  expectString(value, "path");
  if (value.includes("\0")) {
    throw new EvalError("E_PATH_BOUNDARY", "path contains NUL", 3);
  }

  const portable = value.replace(/\\/g, "/");
  const segments = portable.split("/");
  if (
    path.posix.isAbsolute(portable) ||
    /^[A-Za-z]:/.test(portable) ||
    portable.startsWith("//") ||
    segments.includes("..")
  ) {
    throw new EvalError(
      "E_PATH_BOUNDARY",
      `path escapes the fixture root: ${value}`,
      3,
    );
  }

  const normalized = path.posix.normalize(portable);
  if (
    !normalized ||
    normalized === "." ||
    normalized.startsWith("../") ||
    portable !== normalized
  ) {
    throw new EvalError("E_PATH_BOUNDARY", `invalid relative path: ${value}`, 3);
  }
  const lowered = normalized.toLowerCase().split("/");
  if (
    lowered.includes(".git") ||
    lowered.includes(".gitattributes") ||
    lowered.includes(".gitmodules")
  ) {
    throw new EvalError("E_PATH_BOUNDARY", `reserved Git path: ${value}`, 3);
  }
  for (const segment of normalized.split("/")) {
    if (
      /[<>:"|?*\u0001-\u001f]/.test(segment) ||
      /[. ]$/.test(segment) ||
      WINDOWS_DEVICE.test(segment)
    ) {
      throw new EvalError("E_PATH_BOUNDARY", `non-portable path: ${value}`, 3);
    }
  }
  return normalized;
}

function portablePathKey(value) {
  return safeRelativePath(value).normalize("NFC").toLowerCase();
}

function assertKnownFileMap(value, label, allowNull = false) {
  expectObject(value, label);
  const entries = Object.entries(value);
  if (entries.length > MAX_FILE_ENTRIES) {
    schemaError(`${label} exceeds the ${MAX_FILE_ENTRIES} file limit`);
  }
  const canonical = new Map();
  let totalBytes = 0;
  for (const [file, content] of entries) {
    const normalized = safeRelativePath(file);
    const key = portablePathKey(normalized);
    if (canonical.has(key)) {
      throw new EvalError(
        "E_PATH_BOUNDARY",
        `${label} contains colliding paths: ${canonical.get(key)} and ${file}`,
        3,
      );
    }
    canonical.set(key, file);
    if (typeof content !== "string" && !(allowNull && content === null)) {
      schemaError(`${label}.${file} must be ${allowNull ? "a string or null" : "a string"}`);
    }
    if (typeof content === "string") {
      const bytes = Buffer.byteLength(content, "utf8");
      if (bytes > MAX_FILE_CONTENT_BYTES) {
        schemaError(`${label}.${file} exceeds the file content limit`);
      }
      totalBytes += bytes;
      if (totalBytes > MAX_TOTAL_FILE_CONTENT_BYTES) {
        schemaError(`${label} exceeds the total content limit`);
      }
    }
  }
  return canonical;
}

function rejectCrossMapCollisions(left, right, label, allowSamePath = false) {
  for (const [key, rightPath] of right) {
    const leftPath = left.get(key);
    if (leftPath === undefined) continue;
    const samePath = safeRelativePath(leftPath) === safeRelativePath(rightPath);
    if (allowSamePath && samePath) continue;
    throw new EvalError(
      "E_PATH_BOUNDARY",
      `${label} contains colliding paths: ${leftPath} and ${rightPath}`,
      3,
    );
  }
}

function validateGate(gate, label) {
  checkKeys(gate, ["min", "max"], [], label);
  if (!Object.hasOwn(gate, "min") && !Object.hasOwn(gate, "max")) {
    schemaError(`${label} must define min or max`);
  }
  for (const bound of ["min", "max"]) {
    if (!Object.hasOwn(gate, bound)) continue;
    expectFiniteNumber(gate[bound], `${label}.${bound}`);
    if (gate[bound] < 0 || gate[bound] > 1) {
      schemaError(`${label}.${bound} must be between 0 and 1`);
    }
  }
  if (Object.hasOwn(gate, "min") && Object.hasOwn(gate, "max") && gate.min > gate.max) {
    schemaError(`${label}.min cannot exceed ${label}.max`);
  }
}

function validateScenarioFixture(fixture, label) {
  checkKeys(fixture, ["files", "git"], ["files"], label);
  const files = assertKnownFileMap(fixture.files, `${label}.files`);
  if (fixture.git === undefined) return;
  checkKeys(
    fixture.git,
    ["committedFiles", "dirtyFiles"],
    ["committedFiles", "dirtyFiles"],
    `${label}.git`,
  );
  const committed = assertKnownFileMap(
    fixture.git.committedFiles,
    `${label}.git.committedFiles`,
  );
  const dirty = assertKnownFileMap(
    fixture.git.dirtyFiles,
    `${label}.git.dirtyFiles`,
  );
  rejectCrossMapCollisions(files, committed, label);
  rejectCrossMapCollisions(files, dirty, label);
  rejectCrossMapCollisions(committed, dirty, label, true);
}

function validateCountRange(range, label) {
  for (const name of ["min", "max"]) {
    const value = range[name];
    if (!Number.isInteger(value) || value < 0) {
      schemaError(`${label}.${name} must be a non-negative integer`);
    }
  }
  if (range.min > range.max) schemaError(`${label} min cannot exceed max`);
}

function validateQuestionRange(questions, label) {
  checkKeys(questions, ["min", "max", "kinds"], ["min", "max", "kinds"], label);
  validateCountRange(questions, label);
  expectArray(questions.kinds, `${label}.kinds`);
  const kinds = new Set();
  for (const kind of questions.kinds) {
    if (!QUESTION_KINDS.has(kind)) schemaError(`${label}.kinds contains invalid kind`);
    if (kinds.has(kind)) schemaError(`${label}.kinds contains duplicate kind`);
    kinds.add(kind);
  }
}

function validateToolRange(toolCalls, label) {
  checkKeys(toolCalls, ["min", "max"], ["min", "max"], label);
  validateCountRange(toolCalls, label);
}

function validateExpectedFiles(files, label) {
  expectArray(files, label);
  const canonical = new Map();
  files.forEach((expectation, index) => {
    const fileLabel = `${label}[${index}]`;
    checkKeys(expectation, ["path", "equals", "exists"], ["path"], fileLabel);
    const normalized = safeRelativePath(expectation.path);
    const key = portablePathKey(normalized);
    if (canonical.has(key)) {
      throw new EvalError(
        "E_PATH_BOUNDARY",
        `${label} contains colliding paths: ${canonical.get(key)} and ${expectation.path}`,
        3,
      );
    }
    canonical.set(key, expectation.path);
    if (!Object.hasOwn(expectation, "equals") && !Object.hasOwn(expectation, "exists")) {
      schemaError(`${fileLabel} must define equals or exists`);
    }
    if (Object.hasOwn(expectation, "equals") && typeof expectation.equals !== "string") {
      schemaError(`${fileLabel}.equals must be a string`);
    }
    if (Object.hasOwn(expectation, "exists") && typeof expectation.exists !== "boolean") {
      schemaError(`${fileLabel}.exists must be a boolean`);
    }
  });
}

function validateVerificationChecks(checks, label) {
  expectArray(checks, label);
  const checkIds = new Set();
  checks.forEach((check, index) => {
    const checkLabel = `${label}[${index}]`;
    checkKeys(
      check,
      ["id", "command", "exitCode", "required", "requireFailedAttempt"],
      ["id", "command", "exitCode", "required"],
      checkLabel,
    );
    expectIdentifier(check.id, `${checkLabel}.id`);
    if (checkIds.has(check.id)) schemaError(`${checkLabel}.id is duplicated`);
    checkIds.add(check.id);
    expectArray(check.command, `${checkLabel}.command`);
    if (check.command.length === 0) schemaError(`${checkLabel}.command cannot be empty`);
    check.command.forEach((item, itemIndex) =>
      expectString(item, `${checkLabel}.command[${itemIndex}]`),
    );
    if (!Number.isInteger(check.exitCode)) schemaError(`${checkLabel}.exitCode must be an integer`);
    if (typeof check.required !== "boolean") schemaError(`${checkLabel}.required must be boolean`);
    if (
      Object.hasOwn(check, "requireFailedAttempt") &&
      typeof check.requireFailedAttempt !== "boolean"
    ) {
      schemaError(`${checkLabel}.requireFailedAttempt must be boolean`);
    }
  });
}

function validateScenarioExpect(expect, label) {
  checkKeys(
    expect,
    ["decision", "questions", "toolCalls", "readBeforeWrite", "files", "verification"],
    ["decision", "questions", "toolCalls", "files", "verification"],
    label,
  );
  if (!DECISIONS.has(expect.decision)) schemaError(`${label}.decision is invalid`);
  validateQuestionRange(expect.questions, `${label}.questions`);
  validateToolRange(expect.toolCalls, `${label}.toolCalls`);
  if (
    Object.hasOwn(expect, "readBeforeWrite") &&
    typeof expect.readBeforeWrite !== "boolean"
  ) {
    schemaError(`${label}.readBeforeWrite must be boolean`);
  }
  validateExpectedFiles(expect.files, `${label}.files`);
  validateVerificationChecks(expect.verification, `${label}.verification`);
}

function validateScenario(scenario, index) {
  const label = `scenarios[${index}]`;
  checkKeys(
    scenario,
    ["id", "tags", "prompt", "fixture", "expect"],
    ["id", "tags", "prompt", "fixture", "expect"],
    label,
  );
  expectIdentifier(scenario.id, `${label}.id`);
  expectArray(scenario.tags, `${label}.tags`);
  scenario.tags.forEach((tag, tagIndex) =>
    expectString(tag, `${label}.tags[${tagIndex}]`),
  );
  expectString(scenario.prompt, `${label}.prompt`);
  validateScenarioFixture(scenario.fixture, `${label}.fixture`);
  validateScenarioExpect(scenario.expect, `${label}.expect`);
}

function validateSuite(raw) {
  checkKeys(
    raw,
    ["schemaVersion", "profile", "scenarios"],
    ["schemaVersion", "profile", "scenarios"],
    "suite",
  );
  if (raw.schemaVersion !== 1) schemaError("suite.schemaVersion must be 1");
  checkKeys(
    raw.profile,
    ["id", "decisionPolicy", "gates"],
    ["id", "decisionPolicy", "gates"],
    "suite.profile",
  );
  expectIdentifier(raw.profile.id, "suite.profile.id");
  checkKeys(
    raw.profile.decisionPolicy,
    [
      "reversibleInScope",
      "discoverableLocalAmbiguity",
      "externalOrIrreversible",
    ],
    [
      "reversibleInScope",
      "discoverableLocalAmbiguity",
      "externalOrIrreversible",
    ],
    "suite.profile.decisionPolicy",
  );
  const policy = raw.profile.decisionPolicy;
  if (policy.reversibleInScope !== "act") schemaError("reversibleInScope must be act");
  if (policy.discoverableLocalAmbiguity !== "explore_then_act") {
    schemaError("discoverableLocalAmbiguity must be explore_then_act");
  }
  if (policy.externalOrIrreversible !== "ask") {
    schemaError("externalOrIrreversible must be ask");
  }
  expectObject(raw.profile.gates, "suite.profile.gates");
  for (const [name, gate] of Object.entries(raw.profile.gates)) {
    if (!GATE_NAMES.has(name)) schemaError(`suite.profile.gates.${name} is not supported`);
    validateGate(gate, `suite.profile.gates.${name}`);
  }
  for (const name of GATE_NAMES) {
    if (!Object.hasOwn(raw.profile.gates, name)) {
      schemaError(`suite.profile.gates.${name} is required`);
    }
  }

  expectArray(raw.scenarios, "suite.scenarios");
  if (raw.scenarios.length === 0) schemaError("suite.scenarios cannot be empty");
  if (raw.scenarios.length > MAX_SCENARIOS) {
    schemaError(`suite.scenarios exceeds the ${MAX_SCENARIOS} scenario limit`);
  }
  const ids = new Set();
  raw.scenarios.forEach((scenario, index) => {
    validateScenario(scenario, index);
    if (ids.has(scenario.id)) schemaError(`scenario id is duplicated: ${scenario.id}`);
    ids.add(scenario.id);
  });
  return raw;
}

function validateReplayQuestions(questions, label) {
  expectArray(questions, label);
  questions.forEach((question, index) => {
    const questionLabel = `${label}[${index}]`;
    checkKeys(
      question,
      ["blocking", "kind", "reason"],
      ["blocking", "kind", "reason"],
      questionLabel,
    );
    if (typeof question.blocking !== "boolean") schemaError(`${questionLabel}.blocking must be boolean`);
    if (!QUESTION_KINDS.has(question.kind)) schemaError(`${questionLabel}.kind is invalid`);
    expectString(question.reason, `${questionLabel}.reason`);
  });
}

function validateReplayEvents(events, label) {
  expectArray(events, label);
  if (events.length > MAX_REPLAY_EVENTS) {
    schemaError(`${label} exceeds the ${MAX_REPLAY_EVENTS} event limit`);
  }
  let previousSeq = -1;
  let previousRound = -1;
  events.forEach((event, index) => {
    const eventLabel = `${label}[${index}]`;
    checkKeys(
      event,
      ["seq", "type", "round", "callId", "tool", "purpose", "checkId", "ok"],
      ["seq", "type", "round", "callId", "tool", "purpose", "ok"],
      eventLabel,
    );
    if (!Number.isInteger(event.seq) || event.seq <= previousSeq) {
      schemaError(`${eventLabel}.seq must be strictly increasing`);
    }
    previousSeq = event.seq;
    if (!["tool_call", "tool_result", "final"].includes(event.type)) {
      schemaError(`${eventLabel}.type is invalid`);
    }
    if (!Number.isInteger(event.round) || event.round < 0) schemaError(`${eventLabel}.round must be non-negative`);
    if (event.round < previousRound) schemaError(`${eventLabel}.round cannot decrease`);
    previousRound = event.round;
    expectString(event.callId, `${eventLabel}.callId`);
    expectString(event.tool, `${eventLabel}.tool`);
    if (!["work", "verification", "final"].includes(event.purpose)) {
      schemaError(`${eventLabel}.purpose is invalid`);
    }
    if (event.purpose === "verification") {
      expectIdentifier(event.checkId, `${eventLabel}.checkId`);
    } else if (Object.hasOwn(event, "checkId")) {
      schemaError(`${eventLabel}.checkId is only allowed for verification events`);
    }
    if (typeof event.ok !== "boolean") schemaError(`${eventLabel}.ok must be boolean`);
  });
  validateReplayEventProtocol(events, label);
}

function validateReplayEventProtocol(events, label) {
  const calls = new Map();
  let sawFinal = false;
  events.forEach((event, index) => {
    const eventLabel = `${label}[${index}]`;
    if (sawFinal) schemaError(`${eventLabel} cannot follow final`);
    if (event.type === "final") {
      if (
        event.callId !== "final" ||
        event.tool !== "final" ||
        event.purpose !== "final" ||
        !event.ok
      ) {
        schemaError(`${eventLabel} has invalid final metadata`);
      }
      sawFinal = true;
      return;
    }
    if (event.purpose === "final") schemaError(`${eventLabel}.purpose is invalid`);
    if (event.type === "tool_call") {
      if (calls.has(event.callId)) schemaError(`${eventLabel}.callId is duplicated`);
      if (!event.ok) schemaError(`${eventLabel}.ok must be true for a tool call`);
      calls.set(event.callId, {
        tool: event.tool,
        purpose: event.purpose,
        checkId: event.checkId,
        resultSeen: false,
      });
      return;
    }
    const call = calls.get(event.callId);
    if (!call) schemaError(`${eventLabel} has no preceding tool call`);
    if (call.resultSeen) schemaError(`${eventLabel}.callId already has a result`);
    if (
      call.tool !== event.tool ||
      call.purpose !== event.purpose ||
      call.checkId !== event.checkId
    ) {
      schemaError(`${eventLabel} does not match its tool call`);
    }
    call.resultSeen = true;
  });
  if (!sawFinal) schemaError(`${label} must end with one final event`);
  for (const call of calls.values()) {
    if (!call.resultSeen) schemaError(`${label} contains an unfinished tool call`);
  }
}

function validateReplayUsage(usage, label) {
  if (usage !== null) {
    const keys = ["freshInputTokens", "cachedInputTokens", "outputTokens"];
    checkKeys(usage, keys, keys, label);
    for (const name of ["freshInputTokens", "cachedInputTokens", "outputTokens"]) {
      const value = usage[name];
      if (!Number.isInteger(value) || value < 0) schemaError(`${label}.${name} must be non-negative`);
    }
  }
}

function validateReplayClaims(claims, label) {
  expectArray(claims, label);
  const checkIds = new Set();
  claims.forEach((claim, index) => {
    const claimLabel = `${label}[${index}]`;
    checkKeys(claim, ["checkId", "status", "evidenceCallIds"], ["checkId", "status", "evidenceCallIds"], claimLabel);
    expectString(claim.checkId, `${claimLabel}.checkId`);
    if (checkIds.has(claim.checkId)) schemaError(`${claimLabel}.checkId is duplicated`);
    checkIds.add(claim.checkId);
    if (!["passed", "failed"].includes(claim.status)) schemaError(`${claimLabel}.status is invalid`);
    expectArray(claim.evidenceCallIds, `${claimLabel}.evidenceCallIds`);
    const evidenceIds = new Set();
    claim.evidenceCallIds.forEach((id, idIndex) =>
      {
        expectString(id, `${claimLabel}.evidenceCallIds[${idIndex}]`);
        if (evidenceIds.has(id)) {
          schemaError(`${claimLabel}.evidenceCallIds contains a duplicate`);
        }
        evidenceIds.add(id);
      },
    );
  });
}

function validateReplayRun(run, scenarioId) {
  const label = `replay.runs.${scenarioId}`;
  const keys = [
    "decision",
    "questions",
    "events",
    "roundCoverage",
    "usage",
    "verificationClaims",
    "workspace",
  ];
  checkKeys(
    run,
    keys,
    ["decision", "questions", "events", "usage", "verificationClaims", "workspace"],
    label,
  );
  if (!DECISIONS.has(run.decision)) schemaError(`${label}.decision is invalid`);
  validateReplayQuestions(run.questions, `${label}.questions`);
  validateReplayEvents(run.events, `${label}.events`);
  if (run.roundCoverage !== undefined && ![0, 1].includes(run.roundCoverage)) {
    schemaError(`${label}.roundCoverage must be 0 or 1`);
  }
  validateReplayUsage(run.usage, `${label}.usage`);
  validateReplayClaims(run.verificationClaims, `${label}.verificationClaims`);
  assertKnownFileMap(run.workspace, `${label}.workspace`, true);
}

function validateReplay(raw) {
  checkKeys(raw, ["schemaVersion", "runs"], ["schemaVersion", "runs"], "replay");
  if (raw.schemaVersion !== 1) schemaError("replay.schemaVersion must be 1");
  expectObject(raw.runs, "replay.runs");
  for (const [scenarioId, run] of Object.entries(raw.runs)) {
    expectString(scenarioId, "replay scenario id");
    validateReplayRun(run, scenarioId);
  }
  return raw;
}

module.exports = {
  EvalError,
  safeRelativePath,
  validateReplay,
  validateSuite,
};
