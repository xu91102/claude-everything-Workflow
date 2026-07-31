"use strict";

let exists;
let read;
let fail;
let requireTokens;

function bindContext(context) {
  ({ exists, read, fail, requireTokens } = context);
}

function checkRouterAndAgentLinks() {
  requireTokens("skills/using-superpowers/SKILL.md", [
    "Skill Invocation Rule",
    "Task arrives",
    "approved ticket + SDD/commit approved?",
    "external skill learning or edit?",
    "process skills before implementation skills",
    "skills/grilling/SKILL.md",
    "spec-gate",
    "skills/systematic-debugging/SKILL.md",
    "skills/verification-before-completion/SKILL.md",
    "User instructions",
  ]);

  requireTokens("skills/subagent-driven-development/SKILL.md", [
    ".superpowers/sdd/progress.md",
    "scripts/ticket-brief",
    "ticket-state.js",
    "scripts/review-package BASE HEAD",
    "references/ticket-reviewer-prompt.md",
    "Local Git Boundary",
    "不得重复派发",
    "返回 `BLOCKED`",
    "skills/implement/SKILL.md",
  ]);

  requireTokens("skills/subagent-driven-development/references/ticket-reviewer-prompt.md", [
    "Spec Compliance",
    "Ticket quality",
    "Cannot verify from diff",
    "[BRIEF_FILE]",
    "[DIFF_FILE]",
  ]);

  for (const script of [
    "skills/subagent-driven-development/scripts/sdd-workspace",
    "skills/subagent-driven-development/scripts/ticket-brief",
    "skills/subagent-driven-development/scripts/review-package",
  ]) {
    if (!exists(script)) fail(`${script} is missing`);
  }

  const expected = [
    ["agents/e2e-runner.md", "skills/e2e-testing/SKILL.md"],
    ["agents/tdd-guide.md", "skills/test-driven-development/SKILL.md"],
  ];

  for (const [agent, skill] of expected) {
    if (!exists(agent)) fail(`${agent} is missing`);
    if (!exists(skill)) fail(`${skill} is missing`);
    if (exists(agent) && !read(agent).includes(skill)) {
      fail(`${agent} should reference ${skill}`);
    }
  }

  for (const agent of ["agents/harness-optimizer.md"]) {
    if (!exists(agent)) {
      fail(`${agent} is missing`);
      continue;
    }

    const body = read(agent);
    if (body.includes("brainstorming")) {
      fail(`${agent} must not reference the removed brainstorming skill`);
    }
    if (!body.includes("grilling") || !body.includes("spec-gate")) {
      fail(`${agent} should reference grilling and spec-gate`);
    }
  }
}

function checkDebuggingSkill() {
  if (!exists("skills/systematic-debugging/SKILL.md")) {
    fail("skills/systematic-debugging/SKILL.md is missing");
  } else {
    const debugging = read("skills/systematic-debugging/SKILL.md");
    for (const token of [
      "Phase 1: Root Cause Investigation",
      "Phase 2: Pattern Analysis",
      "Phase 3: Hypothesis Test",
      "Phase 4: Fix And Verify",
      "Return To Plan",
    ]) {
      if (!debugging.includes(token)) {
        fail(`skills/systematic-debugging/SKILL.md should include ${token}`);
      }
    }
  }
}

function checkCodeReviewContracts() {
  requireTokens("commands/code-review.md", [
    "固定基点",
    "`git diff <base>...HEAD`",
    "--spec <path>",
    "Spec 轴",
  ]);

  requireTokens("agents/code-reviewer.md", [
    "`git diff <base>...HEAD`",
    "## Standards",
    "## Spec",
    "NOT RUN",
    "不得跨轴合并或重新排序",
  ]);

  requireTokens("README.md", [
    "固定基点、Standards 轴与 Spec 轴",
  ]);

  requireTokens("skills/implement/SKILL.md", [
    "ticket",
    "Spec",
    "code-review",
  ]);

  requireTokens("skills/to-tickets/SKILL.md", [
    "Spec 是架构",
    "blocking graph",
  ]);
}

function checkProjectContextContracts() {
  requireTokens("skills/project-context/SKILL.md", [
    "Only when the user explicitly asks",
    "docs/agent-workflow/project-context.md",
    "CONFIGURED",
    "Do not create an empty `CONTEXT.md`",
    "references/project-context-template.md",
  ]);

  requireTokens("commands/setup-workflow.md", [
    "skills/project-context/SKILL.md",
    "唯一事实来源",
  ]);

  requireTokens("skills/project-context/agents/openai.yaml", [
    "display_name",
    "default_prompt",
    "allow_implicit_invocation: false",
  ]);

  requireTokens("skills/domain-modeling/SKILL.md", [
    "docs/agent-workflow/project-context.md",
  ]);

  requireTokens("skills/using-superpowers/SKILL.md", [
    "explicit /setup-workflow?",
    "project-context",
  ]);

  requireTokens("README.md", [
    "`/setup-workflow`",
    "project-context",
  ]);
}

function checkExecutionSupportSkills() {
  requireTokens("skills/using-git-worktrees/SKILL.md", [
    "git worktree add",
    "git worktree remove",
    "Do not create a worktree for simple single-file edits",
  ]);

  requireTokens("skills/implement/SKILL.md", [
    "frontier",
    "fresh context",
    "test-driven-development",
    "skills/systematic-debugging/SKILL.md",
    "skills/verification-before-completion/SKILL.md",
  ]);

  requireTokens("skills/verification-before-completion/SKILL.md", [
    "fresh verification evidence",
    "skills/systematic-debugging/SKILL.md",
    "skipped checks",
    "remaining risk",
  ]);

  requireTokens("skills/iterative-retrieval/SKILL.md", [
    "Dispatch",
    "Evaluate",
    "Refine",
    "最多跑 3 轮",
    "回传格式",
  ]);

  requireTokens("skills/feature-acceptance/SKILL.md", [
    "PASS / FAIL / BLOCKED / NOT RUN",
    "用例矩阵",
    "keyNodes",
    "evidenceMedium",
    "二次审核",
    "skills/e2e-testing/SKILL.md",
    "敏感信息",
  ]);
}

function checkSkillLinks() {
  checkRouterAndAgentLinks();
  checkDebuggingSkill();
  checkCodeReviewContracts();
  checkProjectContextContracts();
  checkExecutionSupportSkills();
}

function checkRuleLoadingPolicy() {
  if (!exists("AGENTS.md")) {
    fail("AGENTS.md is missing");
    return;
  }

  const agentsBody = read("AGENTS.md");
  if (!agentsBody.includes("规则加载策略")) {
    fail("AGENTS.md should include a rule loading policy section");
  }

  const forbidsFullRulesLoad =
    agentsBody.includes("不要默认全量加载 `rules/`") ||
    agentsBody.includes("不要默认全量加载`rules/`") ||
    agentsBody.includes("仍然只读取当前任务直接相关的规则文件");

  const forbidsFullCommonLoad =
    agentsBody.includes("不要默认全量加载 `rules/common/`") ||
    agentsBody.includes("不要默认全量加载`rules/common/`") ||
    agentsBody.includes("`rules/common/` 是专项参考区");

  if (!forbidsFullRulesLoad || !forbidsFullCommonLoad) {
    fail("AGENTS.md should forbid loading all rules by default");
  }
  if (!agentsBody.includes("~/.codex/rules/")) {
    fail("AGENTS.md should mention Codex user-level rules fallback");
  }
  if (!agentsBody.includes("~/.claude/rules/")) {
    fail("AGENTS.md should mention Claude Code user-level rules fallback");
  }
  if (!agentsBody.includes("不能把项目规则目录缺失等同于") || !agentsBody.includes("无规则")) {
    fail("AGENTS.md should forbid treating a missing project rules directory as no rules");
  }

  if (exists("CLAUDE.md")) {
    const claudeBody = read("CLAUDE.md");
    if (!claudeBody.includes("AGENTS.md")) {
      fail("CLAUDE.md should reference AGENTS.md");
    }
  }

  if (!exists("rules/08-ecc-integration.md")) {
    fail("rules/08-ecc-integration.md is missing");
    return;
  }

  const ecc = read("rules/08-ecc-integration.md");
  if (!ecc.includes("触发矩阵")) {
    fail("rules/08-ecc-integration.md should include a trigger matrix");
  }
  if (!ecc.includes("不得因为") || !ecc.includes("可能有用") || !ecc.includes("而一次性读取完整")) {
    fail(
      "rules/08-ecc-integration.md should forbid full rules loading just because it might be useful",
    );
  }
}

function runRepositoryChecks(context) {
  bindContext(context);
  checkSkillLinks();
  checkRuleLoadingPolicy();
}

module.exports = { runRepositoryChecks };
