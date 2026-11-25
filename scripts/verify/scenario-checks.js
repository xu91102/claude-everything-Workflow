"use strict";

const { parseFrontmatter } = require("./skill-manifest-checks");

const SCENARIOS_PATH = "evals/routing-scenarios.json";
const MIN_SCENARIO_COUNT = 25;

function validateScenarios(data, { exists, read, manifest }) {
  const errors = [];
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.scenarios)) {
    return [`${SCENARIOS_PATH} must have schemaVersion 1 and a scenarios array`];
  }
  if (data.scenarios.length < MIN_SCENARIO_COUNT) {
    errors.push(`${SCENARIOS_PATH} must include at least ${MIN_SCENARIO_COUNT} scenarios (found ${data.scenarios.length})`);
  }

  const registeredSkills = new Set((manifest?.skills || []).map((entry) => entry.path));
  const routerBody = exists("skills/using-superpowers/SKILL.md") ? read("skills/using-superpowers/SKILL.md") : "";
  const seenIds = new Set();

  for (const scenario of data.scenarios) {
    if (!scenario || typeof scenario !== "object") {
      errors.push("scenario entry must be an object");
      continue;
    }
    const { id, prompt, expectedTarget, expectedReference, expectedLane, requiredSignals } = scenario;
    if (!id || typeof id !== "string") {
      errors.push("scenario is missing string id");
      continue;
    }
    if (seenIds.has(id)) errors.push(`duplicate scenario id: ${id}`);
    seenIds.add(id);

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 6) {
      errors.push(`scenario ${id} must have a non-empty prompt`);
    }
    if (!expectedLane || typeof expectedLane !== "string") {
      errors.push(`scenario ${id} must declare expectedLane`);
    }
    if (!Array.isArray(requiredSignals) || requiredSignals.length === 0) {
      errors.push(`scenario ${id} must declare non-empty requiredSignals`);
    }

    if (expectedTarget === null) {
      for (const signal of requiredSignals || []) {
        if (!routerBody.toLowerCase().includes(signal.toLowerCase())) {
          errors.push(`scenario ${id}: router should cover exclusion signal "${signal}"`);
        }
      }
      continue;
    }

    if (typeof expectedTarget !== "string" || !exists(expectedTarget)) {
      errors.push(`scenario ${id}: expectedTarget does not exist: ${expectedTarget}`);
      continue;
    }
    if (expectedTarget.startsWith("skills/") && expectedTarget.endsWith("/SKILL.md") && !registeredSkills.has(expectedTarget)) {
      errors.push(`scenario ${id}: expectedTarget skill is not registered in harness/manifest.json: ${expectedTarget}`);
    }
    if (expectedReference && !exists(expectedReference)) {
      errors.push(`scenario ${id}: expectedReference does not exist: ${expectedReference}`);
    }

    const targetBody = read(expectedTarget);
    const refBody = expectedReference && exists(expectedReference) ? read(expectedReference) : "";
    let description = "";
    if (expectedTarget.endsWith("/SKILL.md")) {
      const fm = parseFrontmatter(targetBody);
      description = String(fm?.description || "");
    }
    const searchable = `${routerBody}\n${description}\n${targetBody}\n${refBody}`.toLowerCase();
    for (const signal of requiredSignals || []) {
      if (!searchable.includes(signal.toLowerCase())) {
        errors.push(`scenario ${id}: expected route surface for ${expectedTarget} does not cover signal "${signal}"`);
      }
    }
  }

  return errors;
}

function runScenarioChecks(context) {
  const { exists, read, fail } = context;
  if (!exists(SCENARIOS_PATH)) {
    fail(`${SCENARIOS_PATH} is missing`);
    return;
  }
  let data;
  try {
    data = JSON.parse(read(SCENARIOS_PATH));
  } catch (error) {
    fail(`${SCENARIOS_PATH} is invalid JSON: ${error.message}`);
    return;
  }
  let manifest = { skills: [] };
  if (exists("harness/manifest.json")) {
    try {
      manifest = JSON.parse(read("harness/manifest.json"));
    } catch {
      // manifest syntax errors are reported by skill-manifest-checks
    }
  }
  for (const error of validateScenarios(data, { exists, read, manifest })) {
    fail(error);
  }
}

module.exports = { SCENARIOS_PATH, MIN_SCENARIO_COUNT, validateScenarios, runScenarioChecks };
