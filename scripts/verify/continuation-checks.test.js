"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHarnessContext, createTokenChecker } = require("./core");
const { runGrillingSpecGateChecks } = require("./grilling-spec-gate-checks");

const root = path.resolve(__dirname, "../..");
const domain = "skills/domain-modeling/SKILL.md";
const outcomes = "skills/using-superpowers/references/process-outcomes.md";
const spec = "skills/spec-gate/SKILL.md";
const router = "skills/using-superpowers/SKILL.md";
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// Inject regressions in memory so tests exercise the real gates without changing the working tree.
function verify(overrides = {}) {
  const context = createHarnessContext(root);
  context.read = (file) => overrides[file] ?? read(file);
  context.requireTokens = createTokenChecker(context);
  runGrillingSpecGateChecks(context);
  return context.errors;
}

assert.deepEqual(verify(), []);

const regressions = [
  {
    name: "maintenance changes a confirmed decision without approval",
    file: domain,
    body: read(domain).replace(/changes to\s+confirmed decisions, and\s*/, ""),
    error: /should include changes to/,
  },
  {
    name: "per-term approval despite maintenance authorization",
    file: domain,
    body: read(domain) + "\nWhen a term becomes stable, show the exact glossary change and obtain write approval before\nupdating it inline.\n",
    error: /not require per-term approval/,
  },
  {
    name: "maintenance without initial authorization",
    file: domain,
    body: read(domain).replace("If maintenance is not yet authorized, obtain approval before writing", "Write immediately"),
    error: /should include If maintenance is not yet authorized/,
  },
  {
    name: "maintenance expands into new scope",
    file: domain,
    body: read(domain).replace("New paths or scope", "Any document"),
    error: /should include New paths or scope/,
  },
  {
    name: "permission required just to clarify",
    file: outcomes,
    body: read(outcomes) + "\nOnly an explicit choice to continue starts a new grilling session.\n",
    error: /not request permission to clarify/,
  },
  {
    name: "clarification continues without an answer",
    file: outcomes,
    body: read(outcomes).replace("Wait for the user's answer", "Continue without the user's answer"),
    error: /should include Wait for the user's answer/,
  },
  {
    name: "blocked Spec stops the router's clarification",
    file: outcomes,
    body: read(outcomes).replace(
      "Preserve the confirmed decisions and evidence; do not draft through an unresolved decision.",
      "Stop without drafting, guessing, or invoking another Skill.",
    ),
    error: /not request permission to clarify/,
  },
  {
    name: "clarification ignores the user's stop request",
    file: outcomes,
    body: read(outcomes).replace("If the user pauses or ends the task, stop.", ""),
    error: /should include If the user pauses or ends the task, stop/,
  },
  {
    name: "clarification expands authorization to external actions",
    file: outcomes,
    body: read(outcomes).replace(/A new scope or external action still requires its own\s+authorization;/, ""),
    error: /should include A new scope or external action still requires its own/,
  },
  {
    name: "implementation without Spec approval",
    file: spec,
    body: read(spec).replace("the user has explicitly approved it", "the agent considers it ready"),
    error: /should include the user has explicitly approved it/,
  },
  {
    name: "ordinary document edit starts the heavy chain",
    file: router,
    body: read(router).replace("不生成 Spec/ticket 或加载完整实现/TDD/审查链", "生成 Spec/ticket 并加载完整实现/TDD/审查链"),
    error: /route .*无行为变化.*missing action/,
  },
  {
    name: "a single decision triggers a full interview",
    file: router,
    body: read(router).replace("不为单问题加载访谈流程", "为单问题加载访谈流程"),
    error: /route .*unresolved user-owned decision.*missing action/,
  },
  {
    name: "high risk implementation before approval",
    file: router,
    body: read(router).replace("批准后才实施", "直接实施后补批准"),
    error: /route .*high-risk boundary.*missing action/,
  },
  {
    name: "verification creates acceptance infrastructure by default",
    file: router,
    body: read(router).replace("普通完成验证不触发工具建设", "普通完成验证先建设工具"),
    error: /route .*explicit project verification.*missing action/,
  },
];

for (const scenario of regressions) {
  assert.match(verify({ [scenario.file]: scenario.body }).join("\n"), scenario.error, scenario.name);
}

console.log(`Continuation contract tests passed (current documents and ${regressions.length} regressions).`);
