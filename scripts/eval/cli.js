#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createAdapter } = require("./adapters");
const {
  DEFAULT_REPLAY,
  DEFAULT_SUITE,
  EvalError,
  loadReplay,
  loadSuite,
  runSuite,
} = require("./core");
const { computeMetrics, evaluateGates } = require("./metrics");

const USAGE = `Behavior Eval

Usage:
  cew eval [--adapter replay|codex|claude] [--scenario ID]
           [--suite PATH] [--replay PATH] [--json] [--output PATH]
           [--keep-fixtures] [--allow-suite-code] [--trust-replay]
           [--timeout-ms N] [--live]
  cew eval --list [--json]
`;

function usageError(message) {
  return new EvalError("E_USAGE", message, 2);
}

function readOptionValue(argv, index, name) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw usageError(`${name} requires a value`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    adapter: "replay",
    scenarios: [],
    suite: DEFAULT_SUITE,
    replay: DEFAULT_REPLAY,
    json: false,
    output: null,
    keepFixtures: false,
    allowSuiteCode: false,
    trustReplay: false,
    timeoutMs: 300000,
    live: false,
    list: false,
    help: false,
  };
  const valueOptions = new Set([
    "--adapter",
    "--scenario",
    "--suite",
    "--replay",
    "--output",
    "--timeout-ms",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (valueOptions.has(arg)) {
      const value = readOptionValue(argv, index, arg);
      index += 1;
      if (arg === "--adapter") options.adapter = value;
      if (arg === "--scenario") options.scenarios.push(value);
      if (arg === "--suite") options.suite = path.resolve(value);
      if (arg === "--replay") options.replay = path.resolve(value);
      if (arg === "--output") options.output = path.resolve(value);
      if (arg === "--timeout-ms") {
        options.timeoutMs = Number(value);
        if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
          throw usageError("--timeout-ms must be a positive integer");
        }
      }
      continue;
    }
    if (arg === "--json") options.json = true;
    else if (arg === "--keep-fixtures") options.keepFixtures = true;
    else if (arg === "--allow-suite-code") options.allowSuiteCode = true;
    else if (arg === "--trust-replay") options.trustReplay = true;
    else if (arg === "--live") options.live = true;
    else if (arg === "--list") options.list = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw usageError(`unknown option: ${arg}`);
  }
  if (!["replay", "codex", "claude"].includes(options.adapter)) {
    throw usageError(`unknown adapter: ${options.adapter}`);
  }
  if (options.adapter === "replay" && options.live) {
    throw usageError("--live requires --adapter codex or --adapter claude");
  }
  if (options.adapter !== "replay" && options.trustReplay) {
    throw usageError("--trust-replay requires --adapter replay");
  }
  return options;
}

function buildCatalog(suite) {
  return {
    schemaVersion: 1,
    profile: suite.profile.id,
    scenarios: suite.scenarios.map((scenario) => ({
      id: scenario.id,
      tags: scenario.tags,
      expectedDecision: scenario.expect.decision,
    })),
  };
}

function buildScenarioReport(record) {
  return {
    id: record.id,
    status: record.status,
    decision: record.decision,
    oraclePassed: record.oraclePassed,
    blockingQuestions: record.blockingQuestions,
    questionsAsked: record.questionsAsked,
    toolRoundTrips:
      record.toolRounds === null ? null : new Set(record.toolRounds).size,
    toolRoundCoverage: record.toolRounds === null ? 0 : 1,
    usageCoverage: record.usage === null ? 0 : 1,
    verificationEvidencePassed: record.verificationEvidencePassed,
    verificationEvidenceTrusted: record.verificationEvidenceTrusted,
    failures: record.failures,
  };
}

function buildReport({ suite, adapter, result, metrics, gateEvaluation }) {
  const scenarios = result.records.map(buildScenarioReport);
  const allScenariosPassed = scenarios.every(
    (scenario) => scenario.status === "passed",
  );
  return {
    schemaVersion: 1,
    profile: suite.profile.id,
    adapter: adapter.name,
    mode: adapter.mode,
    complete: true,
    passed: gateEvaluation.passed && allScenariosPassed,
    counts: {
      scenarios: scenarios.length,
      passed: scenarios.filter((scenario) => scenario.status === "passed").length,
      failed: scenarios.filter((scenario) => scenario.status === "failed").length,
    },
    metrics,
    gates: gateEvaluation.results,
    scenarios,
    fixturePaths: result.fixturePaths,
  };
}

function printable(value) {
  return value === null ? "n/a" : String(value);
}

function formatHuman(report) {
  const lines = [
    `Behavior Eval: ${report.passed ? "PASS" : "FAIL"}`,
    `Profile: ${report.profile}`,
    `Adapter: ${report.adapter} (${report.mode})`,
    `Complete: ${report.complete}`,
    `Passed: ${report.passed}`,
    `Scenarios: ${report.counts.passed}/${report.counts.scenarios} passed`,
    `taskSuccessRate: ${printable(report.metrics.taskSuccessRate)}`,
    `unnecessaryQuestionRate: ${printable(report.metrics.unnecessaryQuestionRate)}`,
    `falseGateRate: ${printable(report.metrics.falseGateRate)}`,
    `toolRoundTrips: ${printable(report.metrics.toolRoundTrips.total)}`,
    `toolRoundCoverage: ${printable(report.metrics.toolRoundTrips.roundCoverage)}`,
    `contextCost: ${printable(report.metrics.contextCost.totalInputTokens)}`,
    `verificationTruthfulness: ${printable(report.metrics.verificationTruthfulness)}`,
  ];
  for (const [name, gate] of Object.entries(report.gates)) {
    const threshold = Object.hasOwn(gate, "min")
      ? `min=${gate.min}`
      : `max=${gate.max}`;
    lines.push(
      `Gate ${name}: ${gate.passed ? "PASS" : "FAIL"} ` +
        `(actual=${printable(gate.actual)}, ${threshold})`,
    );
  }
  for (const scenario of report.scenarios) {
    if (scenario.status === "failed") lines.push(`Failed: ${scenario.id}`);
  }
  for (const fixturePath of report.fixturePaths) {
    lines.push(`Fixture: ${fixturePath}`);
  }
  return `${lines.join("\n")}\n`;
}

function writeJson(target, value) {
  const parent = path.dirname(target);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    throw new EvalError(
      "E_REPORT_WRITE",
      `report directory does not exist: ${parent}`,
      3,
    );
  }
  try {
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  } catch (error) {
    throw new EvalError("E_REPORT_WRITE", `cannot write report: ${target}`, 3, {
      cause: error.code,
    });
  }
}

function safeError(error) {
  if (error instanceof EvalError) {
    const safeDetails = {};
    if (
      error.details &&
      typeof error.details.cause === "string" &&
      /^[A-Z0-9_.-]+$/i.test(error.details.cause)
    ) {
      safeDetails.cause = error.details.cause;
    }
    if (error.details && Number.isInteger(error.details.status)) {
      safeDetails.status = error.details.status;
    }
    return {
      exitCode: error.exitCode,
      body: {
        complete: false,
        passed: false,
        error: {
          code: error.code,
          message: error.message,
          ...(Object.keys(safeDetails).length > 0
            ? { details: safeDetails }
            : {}),
        },
      },
    };
  }
  return {
    exitCode: 5,
    body: {
      complete: false,
      passed: false,
      error: {
        code: "E_INTERNAL",
        message: "internal behavior evaluation error",
      },
    },
  };
}

function dependencies(overrides) {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    createAdapter,
    loadReplay,
    loadSuite,
    runSuite,
    computeMetrics,
    evaluateGates,
    ...overrides,
  };
}

async function execute(options, api) {
  if (options.help) {
    api.stdout.write(USAGE);
    return 0;
  }
  const suite = api.loadSuite(options.suite);
  if (options.list) {
    const catalog = buildCatalog(suite);
    api.stdout.write(
      options.json ? `${JSON.stringify(catalog, null, 2)}\n` : formatCatalog(catalog),
    );
    return 0;
  }
  const replay =
    options.adapter === "replay"
      ? api.loadReplay(options.replay)
      : { schemaVersion: 1, runs: {} };
  const adapter = api.createAdapter({
    name: options.adapter,
    replay,
    live: options.live,
    timeoutMs: options.timeoutMs,
    trustReplay: options.trustReplay,
  });
  const result = await api.runSuite({
    suite,
    adapter,
    selection: options.scenarios,
    keepFixtures: options.keepFixtures,
    allowSuiteCode: options.allowSuiteCode,
  });
  const metrics = api.computeMetrics(result.records);
  const gateEvaluation = api.evaluateGates({
    metrics,
    gates: suite.profile.gates,
  });
  const report = buildReport({
    suite,
    adapter,
    result,
    metrics,
    gateEvaluation,
  });
  if (options.output) {
    try {
      writeJson(options.output, report);
    } catch (error) {
      try {
        await result.cleanup?.();
      } catch {
        // 保留报告写入的原始错误。
      }
      throw error;
    }
  }
  api.stdout.write(
    options.json ? `${JSON.stringify(report, null, 2)}\n` : formatHuman(report),
  );
  return report.passed ? 0 : 1;
}

function formatCatalog(catalog) {
  const lines = [`Behavior Eval profile: ${catalog.profile}`];
  for (const scenario of catalog.scenarios) {
    lines.push(`${scenario.id}\t${scenario.expectedDecision}`);
  }
  return `${lines.join("\n")}\n`;
}

function safeHumanText(value) {
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, "?");
}

async function main(argv = process.argv.slice(2), overrides = {}) {
  const api = dependencies(overrides);
  let options;
  try {
    options = parseArgs(argv);
    return await execute(options, api);
  } catch (error) {
    const failure = safeError(error);
    const json = options?.json ?? argv.includes("--json");
    const body = json
      ? `${JSON.stringify(failure.body, null, 2)}\n`
      :
        `Behavior Eval error [${safeHumanText(failure.body.error.code)}]: ` +
        `${safeHumanText(failure.body.error.message)}\n`;
    (json ? api.stdout : api.stderr).write(body);
    return failure.exitCode;
  }
}

if (require.main === module) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

module.exports = { main, parseArgs };
