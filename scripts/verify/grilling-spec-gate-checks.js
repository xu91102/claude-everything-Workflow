"use strict";

const ACTIVE_BRAINSTORMING_REFERENCE = "skills/brainstorming/SKILL.md";
const PROCESS_OUTCOMES = "references/process-outcomes.md";
const BRAINSTORMING_REFERENCE_ALLOWLIST = new Set([
  "references/workflow-guide.zh-CN.md",
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
      file: PROCESS_OUTCOMES,
      tokens: ["BLOCKED_BY_UNRESOLVED_DECISION", "decision map"],
    }],
  },
  {
    name: "authorized task continues after focused clarification",
    checks: [{
      file: PROCESS_OUTCOMES,
      tokens: ["grilling inline", "Wait for the user's answer", "new Spec Gate", "do not resume the old call stack"],
    }],
  },
  {
    name: "unchanged confirmed decision blocks again",
    checks: [{ file: PROCESS_OUTCOMES, tokens: ["Spec Gate contract conflict"] }],
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
    "the user has explicitly approved it",
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
    "[process outcomes](../../references/process-outcomes.md)",
    "Ordinary direct delivery does not load this reference",
    "spec-gate",
  ]);
  requireTokens(PROCESS_OUTCOMES, [
    "BLOCKED_BY_UNRESOLVED_DECISION",
    "decision map",
    "grilling inline",
    "do not ask whether to continue clarification",
    "Wait for the user's answer",
    "Silence is not a decision or approval.",
    "If the user pauses or ends the task, stop.",
    "A new scope or external action still requires its own",
    "authorization; clarification does not expand the original request.",
    "new Spec Gate",
    "do not resume the old call stack",
    "spec-gate",
  ]);
  if (!exists(file) || !exists(PROCESS_OUTCOMES)) return;

  const body = read(PROCESS_OUTCOMES);
  for (const staleGate of [
    "Only an explicit choice to continue",
    "Let the user choose to continue clarification",
    "Stop without drafting, guessing, or invoking another Skill.",
    "is terminal for the current call chain",
  ]) {
    if (body.includes(staleGate)) {
      fail("Router must ask the missing decision within the authorized task, not request permission to clarify");
    }
  }
  for (const scenario of ROUTING_SCENARIOS) {
    for (const check of scenario.checks) requireTokens(check.file, check.tokens);
  }
}

function checkSupportingSkills({ exists, read, fail, requireTokens }) {
  requireTokens("skills/grilling/SKILL.md", [
    "Route context:",
    "Risk classification:",
    "Resume target:",
    "resume_target: spec-gate",
    "return to `references/process-outcomes.md`",
  ]);
  requireTokens("skills/domain-modeling/SKILL.md", [
    "bounded context",
    "lifecycle",
    "CONTEXT.md",
    "approved Spec",
    "Reuse existing maintenance authorization",
    "within the approved paths and scope",
    "If maintenance is not yet authorized, obtain approval before writing",
    "New paths or scope",
  ]);
  const domain = "skills/domain-modeling/SKILL.md";
  if (exists(domain)) {
    const body = read(domain).replace(/\s+/g, " ");
    if (body.includes("When a term becomes stable, show the exact glossary change and obtain write approval before")) {
      fail("Domain documentation must reuse in-scope maintenance authorization, not require per-term approval");
    }
    for (const constraint of [
      "changes to confirmed decisions",
      "unresolved consequential decisions require approval before the affected edit.",
    ]) {
      if (!body.includes(constraint)) fail(`${domain} should include ${constraint}`);
    }
  }
  requireTokens("skills/visual-companion/SKILL.md", [
    "user consent",
    "grilling owns the decision loop",
    "does not own continuation",
  ]);
  requireTokens("commands/to-spec.md", ["skills/spec-gate/SKILL.md"]);
}

function checkRemovedBrainstormingReferences(context) {
  const { exists, read, managedFiles, fail, isVerifierImplementation } = context;
  for (const agent of ["agents/harness-optimizer.md"]) {
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
  requireTokens("scripts/install-host.js", ["cleanup-retired-skills.js", "--dry-run", "legacy-install-hashes.json"]);
  requireTokens("scripts/retired-skill-files.json", [
    "brainstorming",
    "SKILL.md",
    "scripts/server.cjs",
    "agents/openai.yaml",
    "writing-plans",
    "executing-plans",
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
