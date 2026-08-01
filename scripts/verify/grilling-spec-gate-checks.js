"use strict";

const ACTIVE_BRAINSTORMING_REFERENCE = "skills/brainstorming/SKILL.md";
const BRAINSTORMING_REFERENCE_ALLOWLIST = new Set([
  "README.md",
  "skills/using-superpowers/SKILL.md",
  "scripts/install.sh",
  "scripts/install.ps1",
]);

const ROUTING_SCENARIOS = [
  {
    name: "clear low-risk task",
    checks: [{ file: "skills/using-superpowers/SKILL.md", tokens: ["direct", "clear low-risk task"] }],
  },
  {
    name: "ordinary task with one user decision",
    checks: [{
      file: "skills/using-superpowers/SKILL.md",
      tokens: ["grilling inline", "unresolved user-owned decision"],
    }],
  },
  {
    name: "explicit grilling request",
    checks: [{ file: "skills/using-superpowers/SKILL.md", tokens: ["explicit grilling request", "grilling explicit"] }],
  },
  {
    name: "clear breaking public API migration",
    checks: [{ file: "skills/spec-gate/SKILL.md", tokens: ["clear breaking public API migration", "Spec drafting"] }],
  },
  {
    name: "public API migration with unresolved compatibility",
    checks: [{
      file: "skills/using-superpowers/SKILL.md",
      tokens: ["unresolved user-owned decision", "resume_target: spec-gate"],
    }],
  },
  {
    name: "Spec Gate discovers an unresolved public contract",
    checks: [{
      file: "skills/using-superpowers/SKILL.md",
      tokens: ["BLOCKED_BY_UNRESOLVED_DECISION", "decision map"],
    }],
  },
  {
    name: "user explicitly continues after blocking",
    checks: [{
      file: "skills/using-superpowers/SKILL.md",
      tokens: ["new grilling session", "new Spec Gate", "do not resume the old call stack"],
    }],
  },
  {
    name: "unchanged confirmed decision blocks again",
    checks: [{ file: "skills/using-superpowers/SKILL.md", tokens: ["Spec Gate contract conflict"] }],
  },
  {
    name: "task only consumes established domain vocabulary",
    checks: [{
      file: "skills/domain-modeling/SKILL.md",
      tokens: ["established `CONTEXT.md` vocabulary", "does not trigger it"],
    }],
  },
  {
    name: "new domain entity and lifecycle without a user decision",
    checks: [{ file: "skills/domain-modeling/SKILL.md", tokens: ["subscription entity", "lifecycle states"] }],
  },
  {
    name: "domain boundary remains a user decision",
    checks: [
      { file: "skills/domain-modeling/SKILL.md", tokens: ["Unresolved consequential decisions"] },
      { file: "skills/using-superpowers/SKILL.md", tokens: ["unresolved user-owned decision"] },
    ],
  },
  {
    name: "explicit /to-spec with sufficient context",
    checks: [{ file: "commands/to-spec.md", tokens: ["skills/spec-gate/SKILL.md"] }],
  },
  {
    name: "old brainstorming name compatibility",
    checks: [{
      file: "skills/using-superpowers/SKILL.md",
      tokens: ["Compatibility Alias", "old name `brainstorming`", "/to-spec"],
    }],
  },
  {
    name: "consented visual comparison",
    checks: [{ file: "skills/visual-companion/SKILL.md", tokens: ["user consent", "visual comparisons"] }],
  },
];

function checkRequiredPaths({ exists, fail }) {
  for (const file of [
    "skills/spec-gate/SKILL.md",
    "skills/spec-gate/references/spec-document-reviewer-prompt.md",
    "skills/spec-gate/agents/openai.yaml",
    "skills/domain-modeling/SKILL.md",
    "skills/visual-companion/SKILL.md",
    "skills/visual-companion/references/guide.md",
    "commands/to-spec.md",
  ]) {
    if (!exists(file)) fail(`${file} is missing from the new workflow`);
  }
}

function checkSpecGateContract({ exists, read, fail, requireTokens }) {
  const file = "skills/spec-gate/SKILL.md";
  requireTokens(file, [
    "zero interview",
    "READY_FOR_USER_REVIEW",
    "BLOCKED_BY_UNRESOLVED_DECISION",
    "NOT_APPLICABLE",
    "decision_id",
    "blocking_reason",
    "known_constraints",
    "evidence",
    "Local-only artifact policy",
    "Do not stage or commit it.",
    "Spec Gate contract conflict",
  ]);
  if (!exists(file)) return;

  const body = read(file);
  const blockedSection = body.match(
    /## Outcomes[\s\S]*?BLOCKED_BY_UNRESOLVED_DECISION([\s\S]*?)(?=NOT_APPLICABLE)/,
  );
  if (blockedSection && /^- resume_target\s*$/m.test(blockedSection[1])) {
    fail("Spec Gate blocked outcome must not include resume_target");
  }
  if (/spec-gate\s*->\s*grilling/i.test(body)) {
    fail("Spec Gate must not define an automatic spec-gate -> grilling edge");
  }
}

function checkRouterContract({ exists, read, fail, requireTokens }) {
  const file = "skills/using-superpowers/SKILL.md";
  requireTokens(file, [
    "three lanes",
    "BLOCKED_BY_UNRESOLVED_DECISION",
    "decision map",
    "new grilling session",
    "new Spec Gate",
    "do not resume the old call stack",
    "spec-gate",
  ]);
  if (!exists(file)) return;

  const body = read(file);
  if (/BLOCKED_BY_UNRESOLVED_DECISION[\s\S]{0,240}(?:automatically|auto).*grilling/i.test(body)) {
    fail("Router must stop on Spec Gate blocking instead of automatically invoking grilling");
  }
  for (const scenario of ROUTING_SCENARIOS) {
    for (const check of scenario.checks) requireTokens(check.file, check.tokens);
  }
}

function checkSupportingSkills({ requireTokens }) {
  requireTokens("skills/grilling/SKILL.md", [
    "Route context:",
    "Risk classification:",
    "Resume target:",
    "resume_target: spec-gate",
    "return to `skills/using-superpowers/SKILL.md`",
  ]);
  requireTokens("skills/domain-modeling/SKILL.md", [
    "bounded context",
    "lifecycle",
    "CONTEXT.md",
    "approved Spec",
  ]);
  requireTokens("skills/visual-companion/SKILL.md", [
    "user consent",
    "grilling owns the decision loop",
    "does not own continuation",
  ]);
  requireTokens("commands/to-spec.md", ["skills/spec-gate/SKILL.md"]);
}

function checkRemovedBrainstormingReferences(context) {
  const { exists, read, managedFiles, fail, isVerifierImplementation } = context;
  for (const agent of ["agents/planner.md", "agents/harness-optimizer.md"]) {
    if (exists(agent) && read(agent).includes("brainstorming")) {
      fail(`${agent} must not reference brainstorming after the migration`);
    }
  }

  for (const file of managedFiles()) {
    if (isVerifierImplementation(file) || BRAINSTORMING_REFERENCE_ALLOWLIST.has(file)) continue;
    if (read(file).includes(ACTIVE_BRAINSTORMING_REFERENCE)) {
      fail(`${file} contains active reference to ${ACTIVE_BRAINSTORMING_REFERENCE}`);
    }
  }

  if (exists("skills/brainstorming/SKILL.md")) {
    fail("skills/brainstorming/SKILL.md must be removed");
  }
}

function checkVisualCompanionSecurity({ requireTokens }) {
  requireTokens("skills/visual-companion/references/guide.md", [
    "session key",
    "?key=",
    "4 hours idle",
    "--idle-timeout-minutes",
    "same port",
  ]);
  requireTokens("skills/visual-companion/scripts/server.cjs", [
    "BRAINSTORM_TOKEN",
    "BRAINSTORM_TOKEN_FILE",
    "Default 4 hours",
  ]);
  requireTokens("skills/visual-companion/scripts/server-utils.cjs", [
    "timingSafeEqualStr",
    "Cache-Control",
    "X-Frame-Options",
  ]);
}

function checkInstallerCleanupContract({ requireTokens }) {
  requireTokens("scripts/install.sh", [
    "cleanup_retired_skills",
    "cleanup-retired-skills.js",
    "validate_retired_skill_manifest",
    "--dry-run",
  ]);
  requireTokens("scripts/install.ps1", [
    "Remove-RetiredSkills",
    "cleanup-retired-skills.js",
    "Test-RetiredSkillManifest",
    "--dry-run",
  ]);
  requireTokens("scripts/retired-skill-files.json", [
    "brainstorming",
    "SKILL.md",
    "scripts/server.cjs",
    "agents/openai.yaml",
  ]);
  requireTokens("scripts/cleanup-retired-skills.js", [
    "Preserving unknown files in retired skill",
    "Preserving symlinked retired skill",
    "Preserving retired path through symlink",
  ]);
}

function runGrillingSpecGateChecks(context) {
  checkRequiredPaths(context);
  checkSpecGateContract(context);
  checkRouterContract(context);
  checkSupportingSkills(context);
  checkRemovedBrainstormingReferences(context);
  checkVisualCompanionSecurity(context);
  checkInstallerCleanupContract(context);
}

module.exports = { runGrillingSpecGateChecks };
