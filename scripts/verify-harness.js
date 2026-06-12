#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const errors = [];
const warnings = [];

function rel(...parts) {
  return path.join(root, ...parts);
}

function exists(file) {
  return fs.existsSync(rel(file));
}

function read(file) {
  return fs.readFileSync(rel(file), "utf8");
}

function walk(dir = "") {
  const base = rel(dir);
  if (!fs.existsSync(base)) return [];

  const out = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;

    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(child));
    } else {
      out.push(child.replace(/\\/g, "/"));
    }
  }
  return out;
}

function managedFiles() {
  const roots = [
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "settings.json",
    "commands",
    "agents",
    "skills/continuous-learning-v2",
    "skills/test-driven-development",
    "skills/e2e-testing",
    "skills/brainstorming",
    "skills/using-git-worktrees",
    "skills/executing-plans",
    "skills/writing-plans",
    "skills/systematic-debugging",
    "skills/verification-before-completion",
    "skills/learn",
    "hooks",
    "scripts",
    "rules",
  ];

  return roots.flatMap((item) => {
    const full = rel(item);
    if (!fs.existsSync(full)) return [];

    if (fs.statSync(full).isDirectory()) return walk(item);
    return [item];
  });
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function checkCommands() {
  const commandsDir = rel("commands");
  const commands = fs.existsSync(commandsDir)
    ? fs
        .readdirSync(commandsDir)
        .filter((file) => file.endsWith(".md"))
        .sort()
    : [];

  if (!exists("README.md")) {
    fail("README.md is missing");
    return;
  }

  const listed = Array.from(read("README.md").matchAll(/`\/([^`\s]+)`/g))
    .map((match) => `${match[1]}.md`)
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort();

  for (const file of listed) {
    if (!commands.includes(file)) {
      fail(
        `README lists /${file.replace(/\.md$/, "")} but commands/${file} is missing`,
      );
    }
  }

  for (const file of commands) {
    if (!listed.includes(file)) {
      fail(
        `commands/${file} exists but README does not list /${file.replace(/\.md$/, "")}`,
      );
    }
  }
}

function checkReadmeTreePaths() {
  if (!exists("README.md")) return;

  const body = read("README.md");
  const treeMatch = body.match(/## 目录结构[\s\S]*?```([\s\S]*?)```/);
  if (!treeMatch) {
    fail("README.md should include a directory tree under ## 目录结构");
    return;
  }

  const ignored = new Set([
    "claude-everything-Workflow",
    "agents/...",
  ]);
  const stack = [];

  for (const rawLine of treeMatch[1].split(/\r?\n/)) {
    const markerIndex = rawLine.search(/[├└]──/);
    if (markerIndex < 0) continue;

    const match = rawLine.match(/[├└]──\s+([^#\s]+)/);
    if (!match) continue;

    const normalized = match[1].replace(/\/$/, "");
    if (!normalized || ignored.has(normalized)) continue;

    const depth = Math.floor(markerIndex / 4);
    stack[depth] = normalized;
    stack.length = depth + 1;

    const pathInTree = stack.join("/").replace(/\\/g, "/");
    if (ignored.has(pathInTree)) continue;

    if (!exists(pathInTree)) {
      fail(`README directory tree lists missing path: ${pathInTree}`);
    }
  }
}

function checkInstallRuntimePolicy() {
  requireTokens("README.md", [
    "Codex 安装共享 Workflow 材料，不默认消费 Claude Code `settings.json`",
    "Codex 安装同一套 `hooks/` 脚本材料，但不会因为安装本仓文件而自动启用 Claude Code hooks",
  ]);

  requireTokens("scripts/install.ps1", [
    "Copy-ClaudeSettings",
    "Install-CodexWorkflow",
    "Copy-ConfigFile -Source (Join-Path $RootDir \"AGENTS.md\")",
    "Remove-PackageOnlyPaths",
    "scripts\\install.ps1",
  ]);
  requireTokens("scripts/install.sh", [
    "copy_claude_settings",
    "install_codex()",
    "copy_file \"$ROOT_DIR/AGENTS.md\" \"$dest/AGENTS.md\"",
    "remove_package_only_paths",
    "scripts/install.sh",
  ]);

  const ps = read("scripts/install.ps1");
  const sh = read("scripts/install.sh");
  const sharedDirs = [
    "rules",
    "agents",
    "commands",
    "scripts",
    "hooks",
    "skills",
    "homunculus",
    "references",
  ];

  for (const dir of sharedDirs) {
    if (!ps.includes(`"${dir}"`)) {
      fail(`scripts/install.ps1 shared dirs should include ${dir}`);
    }
    if (!sh.includes(`copy_dir ${dir} "$dest"`)) {
      fail(`scripts/install.sh shared dirs should include ${dir}`);
    }
  }

  const psCodexBody = ps.match(/function Install-CodexWorkflow \{[\s\S]*?\n\}/);
  if (psCodexBody && psCodexBody[0].includes("settings.json")) {
    fail("Install-CodexWorkflow should not install Claude Code settings.json");
  }

  const shCodexBody = sh.match(/install_codex\(\) \{[\s\S]*?\n\}/);
  if (shCodexBody && shCodexBody[0].includes("settings.json")) {
    fail("install_codex should not install Claude Code settings.json");
  }
}

function checkHookConfigReferences() {
  if (!exists("settings.json")) {
    fail("settings.json is missing");
    return;
  }

  const settings = JSON.parse(read("settings.json"));
  const commands = [];

  function collect(value) {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value !== "object") return;
    if (typeof value.command === "string") {
      commands.push(value.command);
    }
    Object.values(value).forEach(collect);
  }

  collect(settings.hooks);

  for (const command of commands) {
    if (command.includes("$HOME/.codex")) {
      fail("settings.json should not point hooks at ~/.codex");
    }
    const matches = [...command.matchAll(/\$HOME\/\.claude\/([^" ]+)/g)];
    for (const match of matches) {
      const referenced = match[1];
      if (!exists(referenced)) {
        fail(`settings.json references missing hook path: ${referenced}`);
      }
    }
  }
}

function checkLearningPathPolicy() {
  for (const dir of [
    "skills/learn",
    "skills/learn/pr",
    "skills/learn/testing",
    "skills/learn/debugging",
  ]) {
    if (!exists(dir)) {
      fail(`${dir} is missing`);
    }
  }

  if (exists("skills/learn")) {
    const rootEntries = fs.readdirSync(rel("skills/learn"), {
      withFileTypes: true,
    });
    for (const entry of rootEntries) {
      if (entry.isFile() && ![".gitkeep", "README.md"].includes(entry.name)) {
        fail(
          `skills/learn root should not contain ${entry.name}; use a category directory`,
        );
      }
    }
  }

  requireTokens("README.md", [
    "skills/learn/<category>/",
    "观察、候选和迁移来源",
  ]);
  requireTokens("commands/evolve.md", [
    "skills/learn/<category>/",
    "候选证据来源",
  ]);
  requireTokens("commands/learn-eval.md", [
    "skills/learn/<category>/",
    "权威学习产物",
  ]);
  requireTokens("rules/common/skills-learning.md", [
    "skills/learn/<category>/",
    "最终可复用学习产物",
  ]);
}

function checkRouterTargets() {
  const expected = [
    ["commands/code-review.md", ["agents/code-reviewer.md"]],
    [
      "commands/tdd.md",
      ["agents/tdd-guide.md", "skills/test-driven-development/SKILL.md"],
    ],
    [
      "commands/e2e.md",
      ["agents/e2e-runner.md", "skills/e2e-testing/SKILL.md"],
    ],
    ["commands/harness-audit.md", ["agents/harness-optimizer.md"]],
  ];

  for (const [command, targets] of expected) {
    if (!exists(command)) {
      fail(`${command} is missing`);
      continue;
    }

    const body = read(command);
    for (const target of targets) {
      if (!exists(target)) {
        fail(`${command} references missing ${target}`);
      }

      const token = target
        .replace(/^agents\//, "")
        .replace(/^skills\//, "skills/")
        .replace(/\.md$/, "")
        .replace(/\/SKILL$/, "");

      if (!body.includes(token) && !body.includes(target)) {
        fail(`${command} should mention ${target}`);
      }
    }
  }
}

function checkNpmPackageSurface() {
  requireTokens("package.json", [
    '"name": "claude-everything-workflow"',
    '"bin"',
    '"claude-everything-workflow": "bin/claude-everything-workflow.js"',
    '"cew": "bin/claude-everything-workflow.js"',
    '"scripts/"',
  ]);

  requireTokens("bin/claude-everything-workflow.js", [
    "cew install",
    "cew verify",
  ]);

  const cliHelp = spawnSync(
    process.execPath,
    ["bin/claude-everything-workflow.js", "--help"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
    },
  );
  if (cliHelp.status !== 0 || !cliHelp.stdout.includes("cew install")) {
    fail(
      `npm CLI help failed:\n${cliHelp.stdout}${cliHelp.stderr}`,
    );
  }
}

function checkSkillLinks() {
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

    if (!read(agent).includes("brainstorming")) {
      fail(`${agent} should reference brainstorming skill`);
    }
  }

  if (!exists("skills/writing-plans/SKILL.md")) {
    fail("skills/writing-plans/SKILL.md is missing");
  } else {
    const writingPlans = read("skills/writing-plans/SKILL.md");
    const requiredTokens = [
      "Project-Agent Loop",
      "skills/using-git-worktrees/SKILL.md",
      "skills/executing-plans/SKILL.md",
      "agents/tdd-guide.md",
      "agents/code-reviewer.md",
      "skills/systematic-debugging/SKILL.md",
      "skills/verification-before-completion/SKILL.md",
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

function requireTokens(file, tokens) {
  if (!exists(file)) {
    fail(`${file} is missing`);
    return;
  }

  const body = read(file);
  for (const token of tokens) {
    if (!body.includes(token)) {
      fail(`${file} should include ${token}`);
    }
  }
}

function checkSuperpowersDevLoop() {
  requireTokens("README.md", [
    "Superpowers 风格开发闭环",
    "using-git-worktrees",
    "executing-plans",
    "verification-before-completion",
    "没有 spec，不进入 plan",
    "没有用户审核，不进入实现",
    "没有 failing test，不写行为代码",
    "没有 review，不标记任务完成",
    "没有新鲜验证证据，不声明完成、通过、已修复或 ready",
    "没有 verify，不进入 PR",
    "`/learn-eval --preview` 是非阻塞学习建议门",
  ]);

  requireTokens("rules/01-base.md", [
    "Spec Gate",
    "User Review Gate",
    "Plan Gate",
    "Red Test Gate",
    "Task Review Gate",
    "Verify Gate",
    "PR Gate",
  ]);

  requireTokens("skills/brainstorming/SKILL.md", [
    "Spec Gate",
    "reviewed and approved the saved spec",
  ]);

  requireTokens("skills/writing-plans/SKILL.md", [
    "## Preconditions",
    "approved spec",
    "Plan Gate",
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

  requireTokens("skills/brainstorming/SKILL.md", [
    "docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md",
    "Write design doc",
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
    if ([
      "scripts/verify-harness.js",
      "scripts/install.ps1",
      "scripts/install.sh",
    ].includes(file)) continue;
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

function checkScriptLayout() {
  for (const legacyPath of [
    "scripts/hooks/run-with-flags.js",
    "scripts/hooks/commit-quality.js",
    "scripts/hooks/session-start.js",
    "scripts/hooks/session-end.js",
    "scripts/lib/hook-flags.js",
    "scripts/lib/utils.js",
    "scripts/learning/utils.js",
    "hooks/review-confidence.js",
  ]) {
    if (exists(legacyPath)) {
      fail(`${legacyPath} should not exist after script layout cleanup`);
    }
  }

  for (const requiredPath of [
    "hooks/runtime/run-with-flags.js",
    "hooks/runtime/hook-flags.js",
    "hooks/runtime/session-utils.js",
    "hooks/session-start.js",
    "hooks/session-end.js",
    "hooks/commit-quality.js",
    "scripts/learning/review-confidence.js",
    "scripts/learning/project-utils.js",
    "scripts/learning/projects.js",
    "scripts/learning/promote.js",
    "scripts/learning/migrate-homunculus.js",
  ]) {
    if (!exists(requiredPath)) {
      fail(`${requiredPath} is missing after script layout cleanup`);
    }
  }

  requireTokens("settings.json", [
    "hooks/runtime/run-with-flags.js",
    "hooks/session-start.js",
    "hooks/session-end.js",
  ]);

  requireTokens("scripts/install.ps1", [
    "Remove-ObsoleteWorkflowPaths",
    "scripts\\hooks\\run-with-flags.js",
    "hooks\\review-confidence.js",
  ]);

  requireTokens("scripts/install.sh", [
    "remove_obsolete_workflow_paths",
    "scripts/hooks/run-with-flags.js",
    "hooks/review-confidence.js",
  ]);

  for (const file of managedFiles()) {
    if ([
      "scripts/verify-harness.js",
      "scripts/install.ps1",
      "scripts/install.sh",
    ].includes(file)) continue;
    if (!/\.(md|json|js|ps1|sh)$/.test(file)) continue;

    const body = read(file);
    for (const forbidden of [
      "scripts/hooks/run-with-flags.js",
      "scripts/lib/hook-flags.js",
      "hooks/review-confidence.js",
    ]) {
      if (body.includes(forbidden)) {
        fail(`${file} references legacy path ${forbidden}`);
      }
    }
  }
}

function checkContinuousLearningV21() {
  requireTokens("skills/continuous-learning-v2/config.json", [
    '"version": "2.1"',
    '"data_root": "~/.local/share/ecc-homunculus"',
    '"project_scoped": true',
    '"promotion_min_confidence": 0.7',
  ]);

  requireTokens("skills/continuous-learning-v2/SKILL.md", [
    "Continuous Learning v2.1",
    "projects/<project-id>/",
    "observations.jsonl",
    "/projects",
    "/promote --dry-run",
    "migrate-homunculus.js --dry-run",
    "observer.enabled",
  ]);

  requireTokens("skills/continuous-learning-v2/hooks/observe-v2.js", [
    "registerProject",
    "projects",
    "observations.jsonl",
  ]);

  requireTokens("scripts/learning/review-confidence.js", [
    "--scope <范围>",
    "project",
    "global",
    "legacy",
  ]);

  requireTokens("commands/projects.md", [
    "scripts/learning/projects.js",
    "--register-current",
  ]);

  requireTokens("commands/promote.md", [
    "scripts/learning/promote.js",
    "--dry-run",
    "--apply",
  ]);
}

function checkObserveV2() {
  const hook = rel("skills/continuous-learning-v2/hooks/observe-v2.js");
  const config = rel("skills/continuous-learning-v2/config.json");
  if (fs.existsSync(rel("hooks/observe.js"))) {
    fail("legacy hooks/observe.js should not exist; use observe-v2 only");
  }
  if (!fs.existsSync(hook)) return fail("observe-v2.js is missing");
  if (!fs.existsSync(config))
    return fail("continuous-learning-v2 config is missing");

  const tempHome = rel(".tmp-verify-harness");
  const tempConfigDir = path.join(
    tempHome,
    ".claude",
    "skills",
    "continuous-learning-v2",
  );
  const observationsPath = path.join(
    tempHome,
    ".claude",
    "homunculus",
    "observations.jsonl",
  );

  fs.rmSync(tempHome, { recursive: true, force: true });
  fs.mkdirSync(tempConfigDir, { recursive: true });

  const cfg = JSON.parse(fs.readFileSync(config, "utf8"));
  cfg.observation = cfg.observation || {};
  cfg.observation.enabled = true;
  cfg.observation.store_path = observationsPath;
  fs.writeFileSync(
    path.join(tempConfigDir, "config.json"),
    JSON.stringify(cfg, null, 2),
  );

  const input = JSON.stringify({
    tool: "Edit",
    cwd: root,
    tool_input: { file_path: "README.md" },
    session_id: "verify-harness",
  });

  const result = spawnSync(process.execPath, [hook, "post"], {
    cwd: root,
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
    },
    timeout: 10000,
  });

  if (result.error)
    fail(`observe-v2 smoke test failed: ${result.error.message}`);
  if (result.status !== 0)
    fail(`observe-v2 exited ${result.status}: ${result.stderr}`);
  if (!fs.existsSync(observationsPath)) {
    fail("observe-v2 did not write observations.jsonl");
  } else {
    const firstLine = fs
      .readFileSync(observationsPath, "utf8")
      .split(/\r?\n/)[0];
    try {
      const event = JSON.parse(firstLine);
      if (event.tool !== "Edit" || event.event !== "tool_complete") {
        fail("observe-v2 wrote unexpected observation payload");
      }
    } catch (err) {
      fail(`observe-v2 wrote invalid JSON: ${err.message}`);
    }
  }

  fs.rmSync(tempHome, { recursive: true, force: true });
}

function checkGitDiffWhitespace() {
  const isRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });

  if (isRepo.status !== 0) {
    return;
  }

  const result = spawnSync("git", ["diff", "--check"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });

  if (result.status !== 0) {
    fail(`git diff --check failed:\n${result.stdout}${result.stderr}`);
  } else if (result.stderr.trim()) {
    warn(result.stderr.trim());
  }
}

function main() {
  checkCommands();
  checkReadmeTreePaths();
  checkInstallRuntimePolicy();
  checkHookConfigReferences();
  checkLearningPathPolicy();
  checkRouterTargets();
  checkNpmPackageSurface();
  checkSkillLinks();
  checkRuleLoadingPolicy();
  checkSuperpowersDevLoop();
  checkForbiddenCommandDrift();
  checkScriptLayout();
  checkContinuousLearningV21();
  checkObserveV2();
  checkGitDiffWhitespace();

  if (warnings.length > 0) {
    console.error("Warnings:");
    warnings.forEach((item) => console.error(`- ${item}`));
  }

  if (errors.length > 0) {
    console.error("Harness verification failed:");
    errors.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log("Harness verification passed.");
}

main();
