"use strict";

const {
  exists,
  fail,
  fs,
  managedFiles,
  path,
  read,
  rel,
  requireTokens,
  root,
  spawnSync,
  warn,
} = require("./context");

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

  const LEGACY_HOOK_PATTERNS = [
    "scripts/hooks/run-with-flags.js",
    "scripts/hooks/commit-quality.js",
    "scripts/hooks/session-start.js",
    "scripts/hooks/session-end.js",
    "scripts/lib/hook-flags.js",
    "hooks/observe.js",
    "hooks/review-confidence.js",
    "hooks/session-start.js",
    "hooks/session-end.js",
    "hooks/evaluate-session.js",
    "hooks/pre-compact.js",
    "hooks/runtime/session-utils.js",
  ];

  for (const command of commands) {
    if (command.includes("$HOME/.codex")) {
      fail("settings.json should not point hooks at ~/.codex");
    }
    for (const legacy of LEGACY_HOOK_PATTERNS) {
      if (command.includes(legacy)) {
        fail(`settings.json contains legacy hook path: ${legacy}`);
      }
    }
    const matches = [...command.matchAll(/\$HOME\/\.claude\/([^" ]+)/g)];
    for (const match of matches) {
      const referenced = match[1];
      if (!exists(referenced)) {
        fail(`settings.json references missing hook path: ${referenced}`);
      }
    }
  }

  // 验证安装脚本包含旧版 Hook 清理逻辑
  for (const installer of ["scripts/install.sh", "scripts/install.ps1"]) {
    if (!exists(installer)) continue;
    const body = read(installer);
    if (!body.includes("LEGACY_HOOK_PATTERNS") && !body.includes("isLegacyHook")) {
      fail(`${installer} should include legacy hook path cleanup logic`);
    }
  }
}

function checkGitHubWorkflows() {
  const ci = read(".github/workflows/ci.yml");

  requireTokens(".github/workflows/ci.yml", [
    "pull_request",
    "workflow_dispatch:",
    "npm run verify",
    "npm run pack:dry-run",
    "publish:",
    "needs: verify",
    "id-token: write",
    "node-version: 22.14.0",
    "package-manager-cache: false",
    "npm install -g npm@11.5.1",
    "git config user.name \"github-actions[bot]\"",
    "npm publish",
    "git push origin \"$TAG\"",
  ]);

  if (ci.includes("npm version \"$VERSION\"") || ci.includes("HEAD:main")) {
    fail("ci.yml must not rewrite or push main during publish");
  }
  if (exists(".github/workflows/npm-publish.yml")) {
    fail("legacy npm-publish workflow must be removed");
  }

  requireTokens("README.md", [
    "npm 发布",
    "版本号通过 PR",
    "ci.yml",
    "受信任的发布商",
  ]);
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

function checkSkillCategoryIndex() {
  requireTokens("skills/README.md", [
    "正式 skill 保持 `skills/<skill-name>/SKILL.md` 平铺结构",
    "Process / 门禁",
    "Engineering / 开发实践",
    "Harness / 上下文与编排",
    "Meta / Skill 管理",
    "Learn / 学习沉淀",
  ]);

  const indexed = new Set(
    [...read("skills/README.md").matchAll(/^- `([^`]+)`：/gm)].map(
      (match) => match[1],
    ),
  );
  const skillsDir = rel("skills");
  const actual = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "learn")
    .filter((name) => exists(path.join("skills", name, "SKILL.md")))
    .sort();

  for (const name of actual) {
    if (!indexed.has(name)) {
      fail(`skills/README.md should categorize skill ${name}`);
    }
  }

  for (const name of indexed) {
    if (name === "learn") continue;
    if (!exists(path.join("skills", name, "SKILL.md"))) {
      fail(`skills/README.md lists missing skill ${name}`);
    }
  }

  requireTokens("README.md", [
    "Skill 分类索引",
    "物理目录保持平铺以兼容发现",
    "只有学习产物使用物理分类目录 `skills/learn/<category>/`",
  ]);

  requireTokens("rules/common/skills-learning.md", [
    "正式 skill 目录保持 `skills/<skill-name>/SKILL.md` 平铺结构",
    "分类维护在 `skills/README.md`",
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
    '"eval": "node scripts/eval/cli.js"',
    '"test": "node --test"',
    '"scripts/"',
  ]);

  requireTokens("bin/claude-everything-workflow.js", [
    "cew install",
    "cew verify",
    "cew eval",
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
  if (
    cliHelp.status !== 0 ||
    !cliHelp.stdout.includes("cew install") ||
    !cliHelp.stdout.includes("cew eval")
  ) {
    fail(
      `npm CLI help failed:\n${cliHelp.stdout}${cliHelp.stderr}`,
    );
  }
}

function checkCoreSkillLinks() {
  requireTokens("skills/using-superpowers/SKILL.md", [
    "Skill Invocation Rule",
    "Task arrives",
    "approved plan + SDD/commit approved?",
    "external skill learning or edit?",
    "process skills before implementation skills",
    "skills/brainstorming/SKILL.md",
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

    if (!read(agent).includes("brainstorming")) {
      fail(`${agent} should reference brainstorming skill`);
    }
  }
}

function checkPlanningAndDebuggingLinks() {
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

function checkSupportingSkillLinks() {
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
  checkCoreSkillLinks();
  checkPlanningAndDebuggingLinks();
  checkSupportingSkillLinks();
}
module.exports = {
  checkCommands,
  checkReadmeTreePaths,
  checkInstallRuntimePolicy,
  checkHookConfigReferences,
  checkGitHubWorkflows,
  checkLearningPathPolicy,
  checkSkillCategoryIndex,
  checkRouterTargets,
  checkNpmPackageSurface,
  checkSkillLinks,
};
