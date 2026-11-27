"use strict";

const fs = require("fs");

const ROUTER_PATH = "skills/using-superpowers/SKILL.md";
const MAX_ROUTER_LINES = 50;
const EXPECTED_TOP_LEVEL_RULES = [
  "01-base.md",
  "02-implementation.md",
  "05-git-workflow.md",
];
const RETIRED_SKILL_PATHS = [
  "skills/brainstorming/SKILL.md",
  "skills/writing-plans/SKILL.md",
  "skills/executing-plans/SKILL.md",
  "skills/research/SKILL.md",
  "skills/wayfinder/SKILL.md",
  "skills/find-skills/SKILL.md",
  "skills/project-context/SKILL.md",
  "skills/iterative-retrieval/SKILL.md",
  "skills/using-git-worktrees/SKILL.md",
  "skills/verification-before-completion/SKILL.md",
  "skills/subagent-driven-development/SKILL.md",
  "skills/e2e-testing/SKILL.md",
];
const RETIRED_RULE_PATHS = [
  "rules/07-forbidden.md",
  "rules/08-specialty-rules-index.md",
  "rules/09-first-principles-adversarial-testing.md",
];
const RETIRED_AGENT_PATHS = [
  "agents/harness-optimizer.md",
];

function checkRouterBudget({ exists, read, fail }) {
  if (!exists(ROUTER_PATH)) {
    fail(`${ROUTER_PATH} is missing`);
    return;
  }
  const body = read(ROUTER_PATH);
  const lineCount = body.split(/\r?\n/).length - (body.endsWith("\n") ? 1 : 0);
  if (lineCount > MAX_ROUTER_LINES) {
    fail(`${ROUTER_PATH} exceeds ${MAX_ROUTER_LINES} lines (${lineCount})`);
  }
}

function checkTopLevelRules({ rel, exists, fail }) {
  if (!exists("rules")) {
    fail("rules directory is missing");
    return;
  }
  const actual = fs
    .readdirSync(rel("rules"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_TOP_LEVEL_RULES)) {
    fail(
      `rules/ top-level files must be exactly ${EXPECTED_TOP_LEVEL_RULES.join(", ")}; found: ${actual.join(", ")}`,
    );
  }
  if (!exists("rules/common")) {
    fail("rules/common directory is missing");
  }
}

function checkMergedSkillReferences({ exists, fail }) {
  const required = [
    "skills/implement/SKILL.md",
    "skills/implement/references/ticket-delivery.md",
    "skills/implement/references/parallel-delivery.md",
    "skills/feature-acceptance/SKILL.md",
    "skills/feature-acceptance/references/project-verification.md",
    "skills/feature-acceptance/references/e2e-testing.md",
    "skills/feature-acceptance/references/playwright-patterns.md",
    "skills/using-superpowers/references/process-outcomes.md",
  ];
  for (const file of required) {
    if (!exists(file)) fail(`required workflow file is missing: ${file}`);
  }
}

function checkRetiredReferences({ managedFiles, isVerifierImplementation, read, fail }) {
  const skipFiles = new Set([
    "scripts/install.sh",
    "scripts/install.ps1",
    "scripts/install-rules.js",
    "scripts/retired-skill-files.json",
    "scripts/cleanup-retired-skills.js",
    "scripts/legacy-common-rule-hashes.json",
    "scripts/upstream-capability-map.json",
  ]);
  for (const file of managedFiles()) {
    if (isVerifierImplementation(file) || skipFiles.has(file)) continue;
    if (!/\.(md|json|js|sh|ps1)$/.test(file)) continue;
    const body = read(file);
    for (const retired of [...RETIRED_SKILL_PATHS, ...RETIRED_RULE_PATHS, ...RETIRED_AGENT_PATHS]) {
      if (body.includes(retired)) {
        fail(`${file} references retired path: ${retired}`);
      }
    }
  }
}

function checkVisualCompanionSecurity({ requireTokens }) {
  requireTokens("skills/visual-companion/scripts/server.cjs", [
    "127.0.0.1",
    "isAuthorized(req)",
    "isAllowedWebSocketOrigin(req)",
  ]);
}

function runWorkflowChecks(context) {
  checkRouterBudget(context);
  checkTopLevelRules(context);
  checkMergedSkillReferences(context);
  checkRetiredReferences(context);
  checkVisualCompanionSecurity(context);
}

module.exports = { runWorkflowChecks };
