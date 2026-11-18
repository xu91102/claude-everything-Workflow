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
    "Agent-selected Delivery Topology",
    "delivery request in defined scope?",
    "independent frontier tickets with no overlapping write surface?",
    "skills/subagent-driven-development/SKILL.md",
    "skill discovery or install request?",
    "external skill learning or edit?",
    "process skills before implementation skills",
    "skills/grilling/SKILL.md",
    "spec-gate",
    "skills/systematic-debugging/SKILL.md",
    "rules/common/testing.md",
    "User instructions",
  ]);

  const expected = [
    ["agents/e2e-runner.md", "skills/e2e-testing/SKILL.md"],
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

function checkTicketFirstDelivery() {
  for (const skill of ["writing-plans", "executing-plans"]) {
    if (exists(`skills/${skill}/SKILL.md`)) {
      fail(`skills/${skill}/SKILL.md must be retired for the ticket-first flow`);
    }
  }

  requireTokens("skills/to-tickets/SKILL.md", [
    "tracer bullet",
    "blocking edges",
    "fresh context",
    "file paths",
    "code snippets",
    "Do not publish before approval",
  ]);
  requireTokens("skills/implement/SKILL.md", [
    "test-driven-development",
    "direct-scope contract",
    "无 ticket 范围不得 claim 或写入任何 tracker",
    "[references/ticket-delivery.md](references/ticket-delivery.md)",
  ]);
  requireTokens("skills/implement/references/ticket-delivery.md", [
    "一个 fresh context",
    "ticket as the Spec source",
    "`/code-review --worktree <pre-ticket-base> --spec <ticket>`",
  ]);
  requireTokens("skills/subagent-driven-development/SKILL.md", [
    "frontier ticket",
    "fresh subagent",
    "one ticket",
    "router is executing a user-authorized delivery scope",
    "separate worktree",
    "controller-owned integration worktree",
    "integrate-and-verify gate",
    "task-owned untracked files",
    "every selected ticket body as the combined Spec source",
    "Do not generate a detailed implementation plan",
  ]);
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

  requireTokens("skills/implement/references/ticket-delivery.md", [
    "pre-ticket base",
    "ticket as the Spec source",
  ]);
}

function checkProjectContextContracts() {
  for (const name of ["find-skills", "project-context"]) {
    if (exists(`skills/${name}/SKILL.md`)) fail(`${name} Skill must be retired`);
  }
  for (const file of ["skills/to-tickets/SKILL.md", "skills/triage/SKILL.md", "skills/domain-modeling/SKILL.md"]) {
    requireTokens(file, ["docs/agent-workflow/project-context.md"]);
  }
  requireTokens("skills/to-tickets/SKILL.md", ["does not block drafting", "Before publication"]);
  requireTokens("skills/triage/SKILL.md", ["does not block read-only assessment", "before external changes"]);
}

function checkTrackerDeliveryLifecycle() {
  const deliveryLifecycle =
    "PRECONDITION → ISOLATE → [CLAIM] → EXECUTE → REVIEW → VERIFY → " +
    "[RESOLVE → REFRESH_FRONTIER] → FINISH_DELIVERY";

  requireTokens("skills/implement/SKILL.md", [
    "rules/05-git-workflow.md",
    "clean baseline",
    "pre-delivery base",
    "不覆盖 commit、push 或创建 PR",
    "无 ticket 范围不得 claim 或写入任何 tracker",
  ]);
  requireTokens("rules/05-git-workflow.md", [
    "开发新功能必须使用独立 `git worktree` 和任务分支",
    "单文件新功能也不例外",
  ]);
  requireTokens("skills/implement/references/ticket-delivery.md", [
    "## State Machine",
    deliveryLifecycle,
    "docs/agent-workflow/project-context.md",
    "clean baseline",
    "pre-ticket base",
    "一个 fresh context",
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
    "全分支相称 review",
    "`/verify pre-pr`",
    "`/pr` 或 keep",
    "可重新选择串行 `implement` 或安全 SDD",
    "不得自动关闭外部 Issue",
  ]);

  requireTokens("commands/pr.md", [
    "ticket reference",
    "does not authorize closing",
  ]);
}

function checkExecutionSupportSkills() {
  requireTokens("references/git-worktrees.md", [
    "git worktree add",
    "git worktree remove",
    "rules/05-git-workflow.md",
    "git status --short",
  ]);

  requireTokens("rules/common/testing.md", [
    "本轮",
    "skills/systematic-debugging/SKILL.md",
    "未运行",
    "剩余风险",
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
  checkTicketFirstDelivery();
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
  if (!agentsBody.includes("~/.claude/references/rules/common/")) {
    fail("AGENTS.md should resolve Claude common rules from the cold reference directory");
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

  if (!exists("rules/08-specialty-rules-index.md")) {
    fail("rules/08-specialty-rules-index.md is missing");
    return;
  }

  const specialtyRules = read("rules/08-specialty-rules-index.md");
  if (!specialtyRules.includes("触发矩阵")) {
    fail("rules/08-specialty-rules-index.md should include a trigger matrix");
  }
  if (
    !specialtyRules.includes("不得因为") ||
    !specialtyRules.includes("可能有用") ||
    !specialtyRules.includes("而一次性读取完整")
  ) {
    fail(
      "rules/08-specialty-rules-index.md should forbid full rules loading just because it might be useful",
    );
  }
}

function runRepositoryChecks(context) {
  bindContext(context);
  checkSkillLinks();
  checkRuleLoadingPolicy();
}

module.exports = { runRepositoryChecks };
