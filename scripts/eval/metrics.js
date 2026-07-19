"use strict";

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (typeof p !== "number" || p < 0 || p > 1) {
    throw new RangeError("percentile p must be between 0 and 1");
  }

  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 1) return sorted[0];

  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];

  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function computeMetrics(records) {
  const completed = records.filter((record) => record.adapterCompleted);
  const successful = completed.filter(
    (record) =>
      record.oraclePassed && record.decision === record.expectedDecision,
  );
  const expectedCompleted = records.filter(
    (record) => record.expectedDecision === "completed",
  );
  const unnecessaryQuestions = expectedCompleted.filter(
    (record) => (record.questionsAsked ?? record.blockingQuestions) > 0,
  );
  const falseGates = expectedCompleted.filter(
    (record) => record.decision === "blocked",
  );

  const roundCovered = records.filter((record) => Array.isArray(record.toolRounds));
  const roundsByScenario = roundCovered.map(
    (record) => new Set(record.toolRounds || []).size,
  );
  const totalRounds = roundsByScenario.reduce((sum, value) => sum + value, 0);
  const toolCalls = records.reduce(
    (sum, record) => sum + (record.toolCalls || 0),
    0,
  );

  const recordsWithUsage = records.filter((record) => record.usage !== null);
  const usageTotals = recordsWithUsage.reduce(
    (totals, record) => {
      totals.freshInputTokens += record.usage.freshInputTokens;
      totals.cachedInputTokens += record.usage.cachedInputTokens;
      totals.outputTokens += record.usage.outputTokens;
      return totals;
    },
    { freshInputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
  );
  const hasUsage = recordsWithUsage.length > 0;

  const verificationRequired = records.filter(
    (record) => record.verificationRequired,
  );
  const truthfulVerification = verificationRequired.filter(
    (record) => record.oraclePassed && record.verificationEvidencePassed,
  );
  const hasRoundData = roundsByScenario.length > 0;

  return {
    taskSuccessRate: ratio(successful.length, completed.length),
    unnecessaryQuestionRate: ratio(
      unnecessaryQuestions.length,
      expectedCompleted.length,
    ),
    falseGateRate: ratio(falseGates.length, expectedCompleted.length),
    toolRoundTrips: {
      total: hasRoundData ? totalRounds : null,
      mean: hasRoundData ? ratio(totalRounds, roundCovered.length) : null,
      p50: percentile(roundsByScenario, 0.5),
      p95: percentile(roundsByScenario, 0.95),
      toolCalls,
      roundCoverage: ratio(roundCovered.length, records.length),
    },
    contextCost: {
      freshInputTokens: hasUsage ? usageTotals.freshInputTokens : null,
      cachedInputTokens: hasUsage ? usageTotals.cachedInputTokens : null,
      outputTokens: hasUsage ? usageTotals.outputTokens : null,
      totalInputTokens: hasUsage
        ? usageTotals.freshInputTokens + usageTotals.cachedInputTokens
        : null,
      usageCoverage: ratio(recordsWithUsage.length, records.length),
    },
    verificationTruthfulness: ratio(
      truthfulVerification.length,
      verificationRequired.length,
    ),
  };
}

function evaluateGates({ metrics, gates }) {
  const results = {};

  for (const [name, threshold] of Object.entries(gates || {})) {
    const actual = metrics[name];
    let passed = actual !== null && typeof actual === "number";
    let reason = null;

    if (!passed) {
      reason = "insufficient_coverage";
    } else {
      if (Object.hasOwn(threshold, "min") && actual < threshold.min) {
        passed = false;
      }
      if (Object.hasOwn(threshold, "max") && actual > threshold.max) {
        passed = false;
      }
      if (!passed) reason = "threshold_failed";
    }

    results[name] = { actual, ...threshold, passed, reason };
  }

  return {
    passed:
      Object.keys(results).length > 0 &&
      Object.values(results).every((result) => result.passed),
    results,
  };
}

module.exports = { computeMetrics, evaluateGates, percentile };
