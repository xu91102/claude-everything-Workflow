"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHarnessContext } = require("./core");
const { SCENARIOS_PATH, validateScenarios, runScenarioChecks } = require("./scenario-checks");

const root = path.resolve(__dirname, "../..");
const context = createHarnessContext(root);
runScenarioChecks(context);
assert.deepEqual(context.errors, [], `scenario checks failed:\n${context.errors.join("\n")}`);

const data = JSON.parse(fs.readFileSync(path.join(root, SCENARIOS_PATH), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "harness/manifest.json"), "utf8"));

// Negative test: missing target file must fail
const badTargetErrors = validateScenarios(
  {
    schemaVersion: 1,
    scenarios: Array.from({ length: 25 }, (_, i) =>
      i === 0
        ? { id: "bad-target", prompt: "test missing target skill", expectedTarget: "skills/nonexistent/SKILL.md", expectedLane: "direct", requiredSignals: ["x"] }
        : data.scenarios[i % data.scenarios.length],
    ).map((s, i) => ({ ...s, id: `${s.id}-${i}` })),
  },
  { exists: context.exists, read: context.read, manifest },
);
assert.ok(badTargetErrors.some((e) => e.includes("does not exist")), "missing target must fail");

// Negative test: too few scenarios must fail
const tooFewErrors = validateScenarios(
  { schemaVersion: 1, scenarios: data.scenarios.slice(0, 5) },
  { exists: context.exists, read: context.read, manifest },
);
assert.ok(tooFewErrors.some((e) => e.includes("at least")), "too few scenarios must fail");

console.log(`Scenario checks tests passed (${data.scenarios.length} routing scenarios verified).`);
