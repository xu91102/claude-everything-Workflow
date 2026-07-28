"use strict";

const path = require("path");
const { spawnSync } = require("child_process");
const { runGrillingSpecGateChecks } = require("./grilling-spec-gate-checks");

let root;
let exists;
let read;
let managedFiles;
let fail;
let requireTokens;
let isVerifierImplementation;

function bindContext(context) {
  ({
    root,
    exists,
    read,
    managedFiles,
    fail,
    requireTokens,
    isVerifierImplementation,
  } = context);
}

function checkSuperpowersDevLoop() {
  requireTokens("README.md", [
    "Superpowers 风格开发闭环",
    "using-superpowers",
    "subagent-driven-development",
    ".superpowers/sdd",
    "to-spec → to-tickets → implement",
    "tracer-bullet",
    "frontier",
    "?key=",
    "4 小时",
    "using-git-worktrees",
    "iterative-retrieval",
    "verification-before-completion",
    "完整流程适用时",
    "没有批准的 Spec 不生成 tickets",
    "没有批准的 tickets 不进入实现",
    "没有用户审核不进入实现",
    "没有 failing test，不写行为代码",
    "没有 review 不标记任务完成",
    "没有新鲜验证证据，不声明完成、通过、已修复或 ready",
    "没有 verify，不进入 PR",
    "`/learn-eval --preview` 是非阻塞学习建议门",
  ]);

  requireTokens("rules/01-base.md", [
    "Spec Gate",
    "User Review Gate",
    "Ticket Gate",
    "Implement Gate",
    "Red Test Gate",
    "Task Review Gate",
    "Verify Gate",
    "PR Gate",
  ]);

  requireTokens("rules/common/skills-learning.md", [
    "skills/using-superpowers/SKILL.md",
    "process skill 优先于 implementation skill",
    "不凭记忆执行 skill",
  ]);

  requireTokens("skills/spec-gate/SKILL.md", [
    "# Spec Gate",
    "READY_FOR_USER_REVIEW",
    "User Review Gate",
  ]);

  requireTokens("skills/to-tickets/SKILL.md", [
    "## Preconditions",
    "Spec",
    "Ticket Schema",
    "Blocked by",
    "frontier",
    "tracer bullet",
  ]);

  requireTokens("skills/test-driven-development/SKILL.md", [
    "## Red Test Gate",
    "失败测试",
    "替代验证",
  ]);

  requireTokens("commands/verify.md", [
    "Verify Gate",
    "已运行检查",
    "未运行检查",
    "是否可以进入 `/pr`",
  ]);

  requireTokens("commands/pr.md", [
    "PR Gate",
    "`/verify` 或等价验证结果",
    "先回到验证和修复阶段",
  ]);
}

function checkSpecVisualContracts() {
  requireTokens("skills/spec-gate/SKILL.md", [
    "docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md",
    "Self-Review",
  ]);

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

  requireTokens("skills/visual-companion/scripts/start-server.sh", [
    "--idle-timeout-minutes",
    "BRAINSTORM_TOKEN_FILE",
    "umask 077",
    ".last-token",
  ]);
}

function checkSuperpowersArtifactPolicy() {
  requireTokens("rules/05-git-workflow.md", [
    "## Superpowers 本地工件",
    "Superpowers 生成的 spec 和 tickets 仅用于本地工作流",
    "无论保存位置都不得暂存或提交",
  ]);
  requireTokens("skills/spec-gate/SKILL.md", [
    "Local-only artifact policy",
    "Treat every generated design Spec as a local workflow artifact",
    "Do not stage or commit it.",
  ]);
  requireTokens("skills/to-tickets/SKILL.md", [
    "ignored local artifact",
    "docs/superpowers/tickets/",
  ]);

  const repoRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });

  if (
    repoRoot.status !== 0 ||
    path.resolve(repoRoot.stdout.trim()) !== path.resolve(root)
  ) {
    return;
  }

  requireTokens(".gitignore", ["/docs/superpowers/"]);

  const tracked = spawnSync("git", ["ls-files", "docs/superpowers"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });

  if (tracked.status !== 0) {
    fail(`unable to inspect tracked Superpowers artifacts: ${tracked.stderr}`);
  } else if (tracked.stdout.trim()) {
    fail(
      `docs/superpowers artifacts must not be tracked:\n${tracked.stdout.trim()}`,
    );
  }
}

function checkGrillingCoreContracts() {
  requireTokens("skills/grilling/SKILL.md", [
    "one question per turn",
    "recommended answer",
    "reversal evidence",
    "shared understanding",
    "Do not ask for discoverable facts",
    "Inline uncertainty mode",
    "Explicit grilling session",
    "Route context:",
    "Risk classification:",
    "Resume target:",
    "Reversal evidence:",
    "return to `skills/using-superpowers/SKILL.md` for routing",
    "Existing Confirmed Handoff",
    "Do not re-ask them",
    "recorded reversal evidence appears",
  ]);
  requireTokens("skills/using-superpowers/SKILL.md", [
    "discoverable fact",
    "user-owned decision",
    "skills/grilling/SKILL.md",
    "shortest applicable path",
    "explicit formal Spec",
    "high-risk boundary",
  ]);
}

function checkRouteOrdering() {
  const router = read("skills/using-superpowers/SKILL.md");
  const inlineRoute = router.indexOf("unresolved user-owned decision?");
  const specRoute = router.indexOf("explicit formal Spec or high-risk boundary?");
  if (
    inlineRoute === -1 ||
    specRoute === -1 ||
    inlineRoute > specRoute
  ) {
    fail(
      "router should resolve a real user decision before entering formal Spec Gate",
    );
  }

  const grillingContract = read("skills/grilling/SKILL.md");
  if (
    /^\s*(?:recommended )?next skill:/im.test(grillingContract) ||
    /^\s*推荐下一 skill：/m.test(grillingContract)
  ) {
    fail(
      "skills/grilling/SKILL.md should return routing responsibility instead of recommending the next skill",
    );
  }
}

function checkWorkflowDocuments() {
  requireTokens("skills/iterative-retrieval/SKILL.md", [
    "事实缺口",
    "盲点",
    "Dispatch",
    "Evaluate",
    "Refine",
  ]);
  requireTokens("rules/01-base.md", [
    "默认最短闭环、按风险逐级升级",
    "formal spec",
    "高风险边界识别优先于",
    "多文件、新功能、普通行为变化和复杂度本身都不是升级条件",
    "信息足够后立即停止追问",
    "Spec Gate",
    "Ticket Gate",
    "Implement Gate",
    "Task Review Gate",
    "BLOCKED_BY_UNRESOLVED_DECISION",
    "不得自动回到 grilling",
    "不恢复旧调用栈",
  ]);
  requireTokens("rules/common/skills-learning.md", [
    "不自动加载完整 process skill 链",
    "路由选中后",
    "skills/grilling/SKILL.md",
    "skills/spec-gate/SKILL.md",
  ]);
  requireTokens("agents/planner.md", [
    "Ticket Graph Reviewer",
    "不生成第二种实施工件",
    "Spec coverage",
    "Tracer bullets",
    "Frontier",
  ]);
}

function checkComplexityRules() {
  const baseRules = read("rules/01-base.md");
  if (
    baseRules.includes(
      "复杂任务包括新功能、架构调整、多文件行为变化",
    )
  ) {
    fail(
      "rules/01-base.md should not classify new or multi-file behavior work as full-flow by default",
    );
  }
  requireTokens("README.md", [
    "`/grill`",
    "`/to-spec`",
    "`grilling` 是唯一需求澄清引擎",
    "默认最短闭环",
    "按风险逐级升级",
    "完整流程适用时",
    "明确低风险且无未决决策",
  ]);
}

function checkGrillingWorkflow() {
  checkGrillingCoreContracts();
  checkRouteOrdering();
  checkWorkflowDocuments();
  checkComplexityRules();
}

function checkSuperpowersRoutingConsistency() {
  requireTokens("skills/iterative-retrieval/SKILL.md", [
    "返回 `skills/using-superpowers/SKILL.md`",
  ]);
  requireTokens("rules/01-base.md", [
    "高风险边界识别优先于“需求清楚/易回滚”短路",
  ]);
  requireTokens("skills/spec-gate/SKILL.md", [
    "zero interview",
    "BLOCKED_BY_UNRESOLVED_DECISION",
    "Spec Gate contract conflict",
  ]);

}

function checkRemovedSkillReferences() {
  for (const skill of [
    "context-budget",
    "documentation-lookup",
    "discover-unknowns-zh",
    "find-skills",
    "skill-creator",
    "writing-plans",
    "executing-plans",
  ]) {
    for (const file of managedFiles()) {
      if (isVerifierImplementation(file)) continue;
      if (file === "scripts/retired-skill-files.json") continue;
      const lines = read(file).split(/\r?\n/);
      const activeReferences = lines.filter(
        (line) =>
          line.includes(skill) &&
          !(
            file === "README.md" &&
            line.startsWith(`- \`${skill}\` →`)
          ),
      );
      if (activeReferences.length > 0) {
        fail(`${file} still references removed skill ${skill}`);
      }
    }
  }
}

function checkForbiddenCommandDrift() {
  const patterns = [
    [/\/docs\b/, "removed /docs command reference"],
    [/\/instinct-export\b/, "removed /instinct-export command reference"],
    [/\/instinct-import\b/, "removed /instinct-import command reference"],
    [/--decay\b/, "deprecated decay flag"],
    [/decay-confidence/, "deprecated decay-confidence script"],
    [/置信度降低 0\.02/, "automatic confidence decay"],
    [/超过.*天.*删除/, "time-based instinct deletion"],
    [/--max-age\b/, "time-based prune flag"],
    [/清理过期/, "expired-instinct cleanup wording"],
  ];

  for (const file of managedFiles()) {
    if (
      isVerifierImplementation(file) ||
      ["scripts/install.ps1", "scripts/install.sh"].includes(file)
    ) continue;
    if (!/\.(md|json|js|ps1|sh)$/.test(file)) continue;

    const body = read(file);
    const lines = body.split(/\r?\n/);
    for (const [pattern, label] of patterns) {
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          fail(`${file}:${index + 1} contains ${label}: ${line.trim()}`);
        }
      });
    }
  }
}

function runWorkflowChecks(context) {
  bindContext(context);
  checkSuperpowersDevLoop();
  checkSpecVisualContracts();
  checkSuperpowersArtifactPolicy();
  checkGrillingWorkflow();
  checkSuperpowersRoutingConsistency();
  runGrillingSpecGateChecks(context);
  checkRemovedSkillReferences();
  checkForbiddenCommandDrift();
}

module.exports = { runWorkflowChecks };
