"use strict";

const path = require("path");
const { spawnSync } = require("child_process");
const { runGrillingSpecGateChecks } = require("./grilling-spec-gate-checks");
const { runWorkflowOwnershipChecks } = require("./workflow-ownership");

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

function checkReadmeWorkflowContract() {
  requireTokens("README.md", [
    "Ticket-first 工程交付闭环",
    "using-superpowers",
    "?key=",
    "4 小时",
    "using-git-worktrees",
    "iterative-retrieval",
    "to-tickets",
    "implement",
    "subagent-driven-development",
    "verification-before-completion",
    "完整流程适用时",
    "没有批准的必需 Spec 不进入 ticket 或 implement",
    "没有用户审核不进入实现",
    "没有 failing test，不写行为代码",
    "没有 review 不标记任务完成",
    "没有新鲜验证证据，不声明完成、通过、已修复或 ready",
    "没有 verify，不进入 PR",
    "`/learn eval --preview` 是非阻塞学习建议门",
  ]);
}

function checkSuperpowersDevLoop() {
  checkReadmeWorkflowContract();

  requireTokens("rules/01-base.md", [
    "# 执行原则",
    "先理解用户目标",
    "真实调用链",
    "复用项目现有入口",
    "标准库",
    "已安装依赖",
    "最小新增代码",
    "skills/using-superpowers/SKILL.md",
  ]);

  requireTokens("rules/common/skills-learning.md", [
    "skills/using-superpowers/SKILL.md",
    "路由权威来源",
    "rules/01-base.md",
    "rules/common/agent-orchestration.md",
    "不凭记忆执行 skill",
  ]);

  // Skill 正文契约在各自的专门检查中维护；这里仅验证跨文件的闭环入口。
  // 避免同一组流程词在多个检查点重复登记，允许 Skill 删除解释性文案。

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
    "Superpowers 生成的 Spec 和本地 tickets 仅用于本地工作流",
    "无论保存位置都不得暂存或提交",
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
  runWorkflowOwnershipChecks({ read, fail, managedFiles });
  requireTokens("skills/iterative-retrieval/SKILL.md", [
    "事实、证据和盲点缺口",
    "复杂、高风险、多文件或长周期",
    "skills/grilling/SKILL.md",
    "skills/spec-gate/SKILL.md",
    "返回 `skills/using-superpowers/SKILL.md`",
  ]);
  requireTokens("skills/using-superpowers/SKILL.md", [
    "shortest applicable path",
    "File count, new features, and ordinary complexity affect",
    "verification intensity, not the lane",
    "A high-risk boundary",
  ]);
  requireTokens("rules/01-base.md", [
    "rules/common/testing.md",
    "skills/using-superpowers/SKILL.md",
  ]);
  requireTokens("rules/common/testing.md", [
    "隔离端口和环境变量",
    "等待 Web/API ready",
  ]);
  requireTokens("rules/common/context-hygiene.md", [
    "任何外部 mutation",
    "发送消息",
    "写入云文档",
  ]);
  requireTokens("rules/common/hooks.md", [
    "敏感内容只记录风险和证据位置",
  ]);
  requireTokens("rules/common/pr-automation.md", [
    "失败检查不得跳过",
    "Git/PR 操作按 `rules/05-git-workflow.md` 的授权边界执行",
  ]);
  for (const file of [
    "rules/common/context-hygiene.md",
    "rules/common/harness-engineering.md",
    "rules/common/performance.md",
  ]) {
    requireTokens(file, ["rules/common/agent-orchestration.md"]);
  }
  requireTokens("rules/common/skills-learning.md", [
    "路由权威来源",
    "不要因为多文件或普通复杂度加载完整 process skill 链",
    "rules/01-base.md",
    "rules/common/agent-orchestration.md",
  ]);
  requireTokens("agents/planner.md", ["to-tickets", "不写文件路径"]);
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
    "直接提出 grilling 请求",
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
    "返回 `skills/using-superpowers/SKILL.md` 重新路由",
    "不要自行枚举或调用下一 skill",
  ]);
  requireTokens("skills/using-superpowers/SKILL.md", [
    "explicit formal Spec",
    "high-risk boundary",
    "unresolved user-owned decision?",
    "skills/grilling/SKILL.md",
  ]);
  requireTokens("skills/spec-gate/SKILL.md", [
    "zero interview",
    "BLOCKED_BY_UNRESOLVED_DECISION",
    "Spec Gate contract conflict",
  ]);

  const retrieval = read("skills/iterative-retrieval/SKILL.md");
  for (const staleRoute of [
    "交接到 `brainstorming`、`test-driven-development` 或 `executing-plans` skill",
    "再进入 `brainstorming`、`test-driven-development` 或 `executing-plans`",
  ]) {
    if (retrieval.includes(staleRoute)) {
      fail(
        "skills/iterative-retrieval/SKILL.md should return to the router " +
          `instead of enumerating follow-up skills: ${staleRoute}`,
      );
    }
  }

}

function readCapabilityManifest(manifestPath) {
  if (!exists(manifestPath)) {
    fail(`${manifestPath} is missing`);
    return null;
  }
  try {
    return JSON.parse(read(manifestPath));
  } catch (error) {
    fail(`${manifestPath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function checkCapabilityManifestHeader(manifest, manifestPath) {
  const valid =
    manifest.schema_version === 1 &&
    manifest.upstream?.repository === "https://github.com/mattpocock/skills" &&
    /^[0-9a-f]{40}$/.test(manifest.upstream?.commit || "") &&
    manifest.upstream?.baseline === "promoted-engineering";
  if (!valid) fail(`${manifestPath} has an invalid upstream contract`);
}

function checkCapabilityEntries(manifest, manifestPath) {
  const expected = [
    "ask-matt", "code-review", "codebase-design", "diagnosing-bugs",
    "domain-modeling", "grill-with-docs", "implement",
    "improve-codebase-architecture", "prototype", "research",
    "resolving-merge-conflicts", "setup-matt-pocock-skills", "tdd",
    "to-spec", "to-tickets", "triage", "wayfinder",
  ].sort();
  const capabilities = Array.isArray(manifest.capabilities)
    ? manifest.capabilities
    : [];
  const actual = capabilities.map((entry) => entry.upstream).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${manifestPath} must map all 17 promoted engineering capabilities`);
  }
  for (const entry of capabilities) {
    if (!["covered", "adapted"].includes(entry.status)) {
      fail(`${entry.upstream} is not capability-equivalent: ${entry.status}`);
    }
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
      fail(`${entry.upstream} has no local evidence files`);
      continue;
    }
    for (const file of entry.evidence) {
      if (!exists(file)) fail(`${entry.upstream} evidence is missing: ${file}`);
    }
  }
}

function checkCapabilitySupportDependencies(manifest, manifestPath) {
  const dependencies = Array.isArray(manifest.support_dependencies)
    ? manifest.support_dependencies
    : [];
  const handoff = dependencies.find((entry) => entry.upstream === "handoff");
  const valid =
    handoff?.source_group === "productivity" &&
    ["covered", "adapted"].includes(handoff.status) &&
    handoff.evidence?.includes("skills/handoff/SKILL.md") &&
    !handoff.evidence?.includes("commands/handoff.md");
  if (!valid) {
    fail(`${manifestPath} must map the engineering flow's handoff dependency`);
  }
}

function checkCapabilityRouting() {
  requireTokens("skills/using-superpowers/SKILL.md", [
    "explicit workflow advice?",
    "workflow advice mode",
    "explicit TDD request?",
    "agents/tdd-guide.md",
    "explicit E2E or Playwright request?",
    "skills/e2e-testing/SKILL.md",
    "agents/e2e-runner.md",
    "explicit harness audit?",
    "agents/harness-optimizer.md",
    "Agent-selected Delivery Topology",
    "delivery request in defined scope?",
    "independent frontier tickets with no overlapping write surface?",
    "skills/implement/SKILL.md",
    "skills/subagent-driven-development/SKILL.md",
    "explicit prototype or runnable design question?",
    "skills/prototype/SKILL.md",
    "primary-source research or cited research artifact?",
    "skills/research/SKILL.md",
    "huge effort beyond one session?",
    "skills/wayfinder/SKILL.md",
    "skills/to-tickets/SKILL.md",
    "merge or rebase conflict?",
    "skills/resolving-merge-conflicts/SKILL.md",
    "fresh session or prototype branch?",
    "skills/handoff/SKILL.md",
  ]);

  const router = read("skills/using-superpowers/SKILL.md");
  for (const staleGate of [
    "User-invoked Delivery Gates",
    "recommend `to-tickets`; wait for explicit invocation",
    "recommend `implement`; wait for explicit invocation",
  ]) {
    if (router.includes(staleGate)) {
      fail(`router must not retain the obsolete user-invoked delivery gate: ${staleGate}`);
    }
  }

  for (const deliverySkill of [
    "skills/to-tickets/SKILL.md",
    "skills/implement/SKILL.md",
    "skills/subagent-driven-development/SKILL.md",
  ]) {
    if (read(deliverySkill).includes("disable-model-invocation: true")) {
      fail(`${deliverySkill} must remain router-selectable for delivery topology`);
    }
  }
}

function checkCapabilityFiles() {
  for (const file of [
    "skills/codebase-design/SKILL.md",
    "skills/handoff/SKILL.md",
    "skills/implement/SKILL.md",
    "skills/improve-codebase-architecture/SKILL.md",
    "skills/prototype/SKILL.md",
    "skills/research/SKILL.md",
    "skills/resolving-merge-conflicts/SKILL.md",
    "skills/to-tickets/SKILL.md",
    "skills/triage/SKILL.md",
    "skills/wayfinder/SKILL.md",
  ]) {
    if (!exists(file)) fail(`${file} is missing`);
  }

  for (const file of [
    "commands/ask-workflow.md",
    "commands/e2e.md",
    "commands/evolve.md",
    "commands/grill.md",
    "commands/grill-with-docs.md",
    "commands/handoff.md",
    "commands/harness-audit.md",
    "commands/implement.md",
    "commands/improve-codebase-architecture.md",
    "commands/instinct-status.md",
    "commands/learn-eval.md",
    "commands/projects.md",
    "commands/promote.md",
    "commands/prune.md",
    "commands/setup-workflow.md",
    "commands/tdd.md",
    "commands/to-tickets.md",
    "commands/triage.md",
    "commands/wayfinder.md",
  ]) {
    if (exists(file)) fail(`${file} is a redundant Skill wrapper`);
  }
}

function checkDesignCapabilityContracts() {
  requireTokens("skills/codebase-design/SKILL.md", [
    "Module",
    "Interface",
    "Seam",
    "Adapter",
    "Leverage",
    "Locality",
    "deletion test",
    "interface as the test surface",
  ]);
  requireTokens("skills/improve-codebase-architecture/SKILL.md", [
    "disable-model-invocation: true",
    "skills/codebase-design/SKILL.md",
    "skills/visual-companion/SKILL.md",
    "explicit consent",
    "skills/grilling/SKILL.md",
  ]);
  requireTokens("skills/prototype/SKILL.md", [
    "Logic",
    "Visual",
    "throwaway",
    "one command to run",
    "Do not silently continue into production code",
  ]);
  requireTokens("skills/prototype/references/ui.md", [
    "runnable in-project UI prototype",
    "?variant=",
    "real read-only data",
    "production builds",
    "exact URLs",
  ]);
}

function checkDeliveryCapabilityContracts() {
  requireTokens("skills/research/SKILL.md", [
    "background subagent",
    "primary sources",
    "citing each claim",
    "Markdown report",
    ".unknowns/",
  ]);
  requireTokens("skills/resolving-merge-conflicts/SKILL.md", [
    "primary sources",
    "one hunk at a time",
    "Do not abort",
    "Git authorization",
  ]);
  requireTokens("skills/to-tickets/SKILL.md", [
    "tracer bullet",
    "blocking edges",
    "vertical",
    "Do not publish before approval",
    "ready-for-agent",
  ]);
  requireTokens("skills/triage/SKILL.md", [
    "disable-model-invocation: true",
    "needs-triage",
    "needs-info",
    "ready-for-agent",
    "ready-for-human",
    "wontfix",
    "generated by AI during triage",
    "obtain confirmation",
  ]);
  requireTokens("skills/wayfinder/SKILL.md", [
    "disable-model-invocation: true",
    "Destination",
    "Decisions so far",
    "Not yet specified",
    "frontier",
    "one ticket per session",
    "WAY_CLEAR",
    "to-tickets",
  ]);
  requireTokens("skills/test-driven-development/SKILL.md", [
    "Public Seam",
    "测试和调用方应穿过同一个 seam",
    "固定事实",
    "真实系统边界",
    "tracer bullet",
  ]);
  requireTokens("skills/handoff/SKILL.md", [
    "disable-model-invocation: true",
    "temporary directory",
    "private subdirectory",
    "0700",
    "exclusive creation",
    "0600",
    "delete the handoff after consumption",
    "fresh session",
    "Suggested skills",
    "Do not duplicate",
    "Redact",
    "exact path",
  ]);
}

function checkUpstreamCapabilityParity() {
  const manifestPath = "scripts/upstream-capability-map.json";
  const manifest = readCapabilityManifest(manifestPath);
  if (!manifest) return;
  checkCapabilityManifestHeader(manifest, manifestPath);
  checkCapabilityEntries(manifest, manifestPath);
  checkCapabilitySupportDependencies(manifest, manifestPath);
  checkCapabilityRouting();
  checkCapabilityFiles();
  checkDesignCapabilityContracts();
  checkDeliveryCapabilityContracts();
}

function checkRemovedSkillReferences() {
  for (const skill of ["context-budget", "documentation-lookup"]) {
    for (const file of managedFiles()) {
      if (isVerifierImplementation(file)) continue;
      if (read(file).includes(skill)) {
        fail(`${file} still references removed skill ${skill}`);
      }
    }
  }

  const retiredSkills = [
    "discover-unknowns-zh",
    "skill-creator",
    "writing-plans",
    "executing-plans",
  ];
  const allowedRetirementFiles = new Set([
    "README.md",
    "scripts/retired-skill-files.json",
  ]);

  for (const skill of retiredSkills) {
    if (exists(`skills/${skill}/SKILL.md`)) {
      fail(`skills/${skill} should be retired`);
    }
    for (const file of managedFiles()) {
      if (
        isVerifierImplementation(file) ||
        allowedRetirementFiles.has(file)
      ) {
        continue;
      }
      if (read(file).includes(skill)) {
        fail(`${file} still references retired skill ${skill}`);
      }
    }
  }

  requireTokens("README.md", [
    "Skill 迁移说明",
    "`discover-unknowns-zh` 已退休",
    "`iterative-retrieval`",
    "`research`",
    "`prototype`",
    "`to-tickets`",
    "`implementation-notes`、`explainer` 和 `quiz` 工件链不再属于",
    "`skill-creator` 已退休",
    "`rules/common/skills-learning.md`",
    "scripts/upstream-capability-map.json",
  ]);
  requireTokens("scripts/retired-skill-files.json", retiredSkills);
  requireTokens("skills/find-skills/SKILL.md", [
    "name: find-skills",
    "npx skills find",
    "Verify Quality Before Recommending",
  ]);
  requireTokens("rules/common/skills-learning.md", [
    "Skill 创建和更新遵循本规则",
    "开放生态中的 skill 查找和安装由 `find-skills` 处理",
  ]);
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
  checkUpstreamCapabilityParity();
  runGrillingSpecGateChecks(context);
  checkRemovedSkillReferences();
  checkForbiddenCommandDrift();
}

module.exports = { runWorkflowChecks };
