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
    "approved plan + SDD/commit approved?",
    "skill discovery or install request?",
    "find-skills",
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
    "scripts/task-brief",
    "scripts/review-package BASE HEAD",
    "task-reviewer-prompt.md",
    "Local Git Boundary",
    "skills/executing-plans/SKILL.md",
  ]);

  requireTokens("skills/subagent-driven-development/task-reviewer-prompt.md", [
    "Spec Compliance",
    "Task quality",
    "Cannot verify from diff",
    "[BRIEF_FILE]",
    "[DIFF_FILE]",
  ]);

  for (const script of [
    "skills/subagent-driven-development/scripts/sdd-workspace",
    "skills/subagent-driven-development/scripts/task-brief",
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

  for (const agent of ["agents/harness-optimizer.md", "agents/planner.md"]) {
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

function checkWritingPlansSkill() {
  if (!exists("skills/writing-plans/SKILL.md")) {
    fail("skills/writing-plans/SKILL.md is missing");
  } else {
    const writingPlans = read("skills/writing-plans/SKILL.md");
    const requiredTokens = [
      "Project-Agent Loop",
      "skills/using-git-worktrees/SKILL.md",
      "skills/executing-plans/SKILL.md",
      "agents/tdd-guide.md",
      "skills/code-review/references/standards-reviewer-prompt.md",
      "skills/systematic-debugging/SKILL.md",
      "skills/verification-before-completion/SKILL.md",
      "skills/subagent-driven-development/SKILL.md",
      "## Global Constraints",
      "**Interfaces:**",
      "Completion Loop",
      "`/verify`",
      "`/pr`",
    ];

    for (const token of requiredTokens) {
      if (!writingPlans.includes(token)) {
        fail(`skills/writing-plans/SKILL.md should include ${token}`);
      }
    }

    for (const forbidden of [
      "superpowers:subagent-driven-development",
      "superpowers:executing-plans",
    ]) {
      if (writingPlans.includes(forbidden)) {
        fail(`skills/writing-plans/SKILL.md contains dangling ${forbidden}`);
      }
    }
  }
}

function checkDebuggingSkill() {
  if (!exists("skills/systematic-debugging/SKILL.md")) {
    fail("skills/systematic-debugging/SKILL.md is missing");
  } else {
    const debugging = read("skills/systematic-debugging/SKILL.md");
    for (const token of [
      "references/diagnosing-bugs.upstream.md",
      "唯一运行入口",
      "上游原始 Bash 模板留档",
      "scripts/hitl-loop.template.js",
    ]) {
      if (!debugging.includes(token)) {
        fail(`skills/systematic-debugging/SKILL.md should include ${token}`);
      }
    }

    const upstreamPath =
      "skills/systematic-debugging/references/diagnosing-bugs.upstream.md";
    if (!exists(upstreamPath)) {
      fail(`${upstreamPath} is missing`);
    } else {
      const upstreamDebugging = read(upstreamPath);
      for (const token of [
        "# Diagnosing Bugs",
        "## Phase 1 — Build a feedback loop",
        "one command",
        "Red-capable",
        "Deterministic",
        "Fast",
        "Agent-runnable",
        "3–5 ranked hypotheses",
        "higher reproduction rate",
        "## Phase 2 — Reproduce + minimise",
        "## Phase 3 — Hypothesise",
        "## Phase 4 — Instrument",
        "## Phase 5 — Fix + regression test",
        "## Phase 6 — Cleanup + post-mortem",
        "scripts/hitl-loop.template.sh",
        "Show the ranked list to the user before testing",
        "Tag every debug log",
        "what would have prevented this bug?",
        "/improve-codebase-architecture",
      ]) {
        if (!upstreamDebugging.includes(token)) {
          fail(`${upstreamPath} should include ${token}`);
        }
      }
    }

    requireTokens("skills/systematic-debugging/scripts/hitl-loop.template.sh", [
      "Human-in-the-loop reproduction loop.",
      "step()",
      "capture()",
      "ERRORED",
      "ERROR_MSG",
    ]);

    requireTokens("skills/systematic-debugging/scripts/hitl-loop.template.js", [
      "Human-in-the-loop reproduction loop.",
      "async function step",
      "async function capture",
      "完成后按 Enter",
      "输入已结束",
      "ERRORED",
      "ERROR_MSG",
    ]);

    const hitlNode = read(
      "skills/systematic-debugging/scripts/hitl-loop.template.js",
    );
    for (const token of ["(y/n)", "none", "--- Captured ---"]) {
      if (hitlNode.includes(token)) {
        fail(
          `skills/systematic-debugging/scripts/hitl-loop.template.js should not expose English prompt token ${token}`,
        );
      }
    }
  }
}

function checkCodeReviewContracts() {
  requireTokens("commands/code-review.md", [
    "固定基点",
    "`git diff <base>...HEAD`",
    "`git diff <base>`",
    "--worktree",
    "--spec <path>",
    "Spec 轴",
    "skills/code-review/SKILL.md",
    "并行",
  ]);

  requireTokens("skills/code-review/SKILL.md", [
    "two parallel subagents",
    "tracked staged and unstaged",
    "untracked",
    "git diff <base>",
    "standards-reviewer-prompt.md",
    "spec-reviewer-prompt.md",
    "Do not merge or rerank",
  ]);

  requireTokens("skills/code-review/references/standards-reviewer-prompt.md", [
    "Mysterious Name",
    "Duplicated Code",
    "Feature Envy",
    "Data Clumps",
    "Primitive Obsession",
    "Repeated Switches",
    "Shotgun Surgery",
    "Divergent Change",
    "Speculative Generality",
    "Message Chains",
    "Middle Man",
    "Refused Bequest",
    "judgement call",
  ]);

  requireTokens("skills/code-review/references/spec-reviewer-prompt.md", [
    "missing or partial",
    "scope creep",
    "looks implemented but is wrong",
    "NOT RUN",
  ]);

  requireTokens("agents/code-reviewer.md", [
    "skills/code-review/SKILL.md",
    "## Standards",
    "## Spec",
    "two isolated review contexts",
  ]);

  requireTokens("README.md", [
    "固定基点下并行执行隔离的 Standards 轴与 Spec 轴审查",
  ]);

  requireTokens("skills/executing-plans/SKILL.md", [
    "pre-plan commit as the fixed base",
    "Spec source",
  ]);

  requireTokens("skills/writing-plans/SKILL.md", [
    "pre-plan commit as its fixed base",
    "Spec source",
  ]);
}

function checkProjectContextContracts() {
  requireTokens("skills/project-context/SKILL.md", [
    "Only when the user explicitly asks",
    "docs/agent-workflow/project-context.md",
    "CONFIGURED",
    "Do not create an empty `CONTEXT.md`",
    "references/project-context-template.md",
    "bug",
    "enhancement",
  ]);
  requireTokens("skills/project-context/references/project-context-template.md", [
    "`bug`",
    "`enhancement`",
    "Claim",
    "Progress",
    "Resolve",
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
    "explicit project-context setup request?",
    "project-context",
  ]);

  requireTokens("README.md", [
    "直接请求配置 project context",
    "project-context",
  ]);
}

function checkTrackerDeliveryLifecycle() {
  requireTokens("skills/implement/SKILL.md", [
    "disable-model-invocation: true",
    "## State Machine",
    "PRECONDITION → ISOLATE → CLAIM → EXECUTE → REVIEW → VERIFY → RESOLVE → REFRESH_FRONTIER → FINISH_DELIVERY",
    "docs/agent-workflow/project-context.md",
    "skills/using-git-worktrees/SKILL.md",
    "clean baseline",
    "pre-ticket base",
    "writing-plans",
    "subagent-driven-development",
    "ticket as the Spec source",
    "`/code-review --worktree <pre-ticket-base> --spec <ticket>`",
    "frontier",
    "claim",
    "in-progress",
    "resolve",
    "unlocked",
    "explicit confirmation",
    "frontier 为空",
    "frontier 为空但仍有 open tickets",
    "BLOCKED_GRAPH",
    "open ticket count = 0",
    "全分支双轴 review",
    "`/verify pre-pr`",
    "`/pr` 或 keep",
    "不得自动 claim 下一张 ticket",
    "不得自动 commit、push",
    "不得自动关闭外部 Issue",
  ]);

  requireTokens("commands/pr.md", [
    "ticket reference",
    "does not authorize closing",
  ]);
}

function checkExecutionSupportSkills() {
  requireTokens("skills/using-git-worktrees/SKILL.md", [
    "git worktree add",
    "git worktree remove",
    "Do not create a worktree for simple single-file edits",
  ]);

  requireTokens("skills/executing-plans/SKILL.md", [
    "approved implementation plan",
    "Inline Execution",
    "Project-Agent Loop",
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
    "事实、证据和盲点缺口",
    "skills/using-superpowers/SKILL.md",
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
  checkWritingPlansSkill();
  checkDebuggingSkill();
  checkCodeReviewContracts();
  checkProjectContextContracts();
  checkTrackerDeliveryLifecycle();
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
