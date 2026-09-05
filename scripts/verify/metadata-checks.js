"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

let root;
let rel;
let exists;
let read;
let fail;
let requireTokens;

const PACKAGE_ONLY_PATHS = [
  "scripts/install.sh",
  "scripts/install.ps1",
  "scripts/verify-harness.js",
  "scripts/verify/core.js",
  "scripts/verify/grilling-spec-gate-checks.js",
  "scripts/verify/metadata-checks.js",
  "scripts/verify/repository-checks.js",
  "scripts/verify/runtime-checks.js",
  "scripts/verify/workflow-checks.js",
  "scripts/verify/workflow-ownership-fixtures.js",
  "scripts/verify/workflow-ownership.js",
  "scripts/verify/skill-manifest-checks.js",
  "scripts/verify/skill-manifest-checks.test.js",
];

function bindContext(context) {
  ({ root, rel, exists, read, fail, requireTokens } = context);
}

function checkCommands() {
  const commandsDir = rel("commands");
  const commands = fs.existsSync(commandsDir)
    ? fs
        .readdirSync(commandsDir)
        .filter((file) => file.endsWith(".md"))
        .sort()
    : [];
  const expectedCommands = [
    "code-review.md",
    "learn.md",
    "pr.md",
    "to-spec.md",
    "verify.md",
  ];

  if (JSON.stringify(commands) !== JSON.stringify(expectedCommands)) {
    fail(
      `commands must expose exactly: ${expectedCommands.join(", ")}; found: ${commands.join(", ")}`,
    );
  }

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

  requireTokens("commands/learn.md", [
    "/learn eval",
    "/learn status",
    "/learn projects",
    "/learn promote",
    "/learn prune",
    "/learn evolve",
    "scripts/learning/review-confidence.js",
    "scripts/learning/projects.js",
    "scripts/learning/promote.js",
  ]);
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

function quotedPackageOnlyPaths(source, bodyPattern) {
  const body = source.match(bodyPattern)?.[1] ?? "";
  return [...body.matchAll(/"([^"]+)"/g)].map((match) =>
    match[1].replaceAll("\\", "/"),
  );
}

function checkPackageOnlyLists(ps, sh) {
  const psPaths = quotedPackageOnlyPaths(
    ps,
    /\$packageOnlyFiles = @\(([\s\S]*?)\r?\n\s*\)/,
  );
  const shPaths = quotedPackageOnlyPaths(
    sh,
    /remove_package_only_paths\(\) \{[\s\S]*?for file in \\\r?\n([\s\S]*?)\r?\n\s*do/,
  );
  const expected = JSON.stringify(PACKAGE_ONLY_PATHS);
  if (JSON.stringify(psPaths) !== expected) {
    fail(`scripts/install.ps1 package-only list mismatch: ${psPaths.join(", ")}`);
  }
  if (JSON.stringify(shPaths) !== expected) {
    fail(`scripts/install.sh package-only list mismatch: ${shPaths.join(", ")}`);
  }
}

function checkInstallerSurface(ps, sh) {
  const sharedDirs = [
    "rules",
    "agents",
    "commands",
    "scripts",
    "hooks",
    "skills",
    "references",
    "harness",
  ];
  for (const dir of sharedDirs) {
    if (!ps.includes(`"${dir}"`)) {
      fail(`scripts/install.ps1 shared dirs should include ${dir}`);
    }
    if (!sh.includes(`copy_dir ${dir} "$dest"`)) {
      fail(`scripts/install.sh shared dirs should include ${dir}`);
    }
  }
  if (ps.includes('"homunculus"')) {
    fail("scripts/install.ps1 should not install removed homunculus directory");
  }
  if (sh.includes('copy_dir homunculus "$dest"')) {
    fail("scripts/install.sh should not install removed homunculus directory");
  }
  const retiredCommands = [
    "e2e.md", "evolve.md", "grill.md", "harness-audit.md", "instinct-status.md",
    "learn-eval.md", "projects.md", "promote.md", "prune.md", "setup-workflow.md",
    "tdd.md",
  ];
  for (const command of retiredCommands) {
    if (!sh.includes(`commands/${command}`)) {
      fail(`scripts/install.sh should remove retired commands/${command}`);
    }
    if (!ps.includes(`commands\\${command}`)) {
      fail(`scripts/install.ps1 should remove retired commands/${command}`);
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
    "scripts\\verify-harness.js",
    "scripts\\verify",
    "scripts\\verify\\workflow-ownership-fixtures.js",
    "scripts\\verify\\workflow-ownership.js",
  ]);
  requireTokens("scripts/install.sh", [
    "copy_claude_settings",
    "install_codex()",
    "copy_file \"$ROOT_DIR/AGENTS.md\" \"$dest/AGENTS.md\"",
    "remove_package_only_paths",
    "scripts/install.sh",
    "scripts/verify-harness.js",
    "scripts/verify",
    "scripts/verify/workflow-ownership-fixtures.js",
    "scripts/verify/workflow-ownership.js",
  ]);

  const ps = read("scripts/install.ps1");
  const sh = read("scripts/install.sh");
  checkPackageOnlyLists(ps, sh);
  checkInstallerSurface(ps, sh);
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

  requireTokens("scripts/merge-claude-settings.cjs", [
    "LEGACY_HOOK_PATTERNS",
    "cleanHooks",
    "mergeSettings",
  ]);

  for (const installer of ["scripts/install.sh", "scripts/install.ps1"]) {
    if (!exists(installer)) continue;
    const body = read(installer);
    if (!body.includes("merge-claude-settings.cjs")) {
      fail(`${installer} should invoke the shared Claude settings merger`);
    }
  }
}

function runCommand(command, args, { allowFailure = false, ...options } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 30000,
    ...options,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stdout}${result.stderr}`,
    );
  }
  return result;
}

function releaseScenario({ exactPublished = false, publishFails = false, tagAt }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cew-release-"));
  const repository = path.join(tempRoot, "repository");
  const remote = path.join(tempRoot, "remote.git");
  const npmLog = path.join(tempRoot, "npm-calls.jsonl");
  const isolatedGitEnvironment = {
    ...process.env,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    XDG_CONFIG_HOME: path.join(tempRoot, "xdg-config"),
  };
  const git = (args, options = {}) => runCommand("git", args, {
    env: isolatedGitEnvironment,
    ...options,
  });

  try {
    fs.mkdirSync(repository);
    git(["init", "--bare", remote]);
    git(["init", repository]);
    git(["-C", repository, "config", "user.name", "Release Test"]);
    git(["-C", repository, "config", "user.email", "release@example.com"]);
    fs.writeFileSync(
      path.join(repository, "package.json"),
      JSON.stringify({ name: "claude-everything-workflow", version: "0.2.2" }),
    );
    git(["-C", repository, "add", "package.json"]);
    git(["-C", repository, "commit", "-m", "initial"]);
    const firstCommit = git(["-C", repository, "rev-parse", "HEAD"]).stdout.trim();
    fs.writeFileSync(path.join(repository, "release.txt"), "current\n");
    git(["-C", repository, "add", "release.txt"]);
    git(["-C", repository, "commit", "-m", "current"]);
    const currentCommit = git(["-C", repository, "rev-parse", "HEAD"]).stdout.trim();
    git(["-C", repository, "remote", "add", "origin", remote]);

    if (tagAt) {
      const target = tagAt === "current" ? currentCommit : firstCommit;
      git(["-C", repository, "tag", "-a", "v0.2.2", target, "-m", "test tag"]);
      git(["-C", repository, "push", "origin", "v0.2.2"]);
    }

    const npmStub = path.join(tempRoot, "npm-stub.js");
    fs.writeFileSync(
      npmStub,
      `const fs = require("fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.NPM_CALL_LOG, JSON.stringify(args) + "\\n");
if (args[0] === "view" && args[1].includes("@0.2.2")) {
  if (process.env.EXACT_PUBLISHED === "true") {
    process.stdout.write("0.2.2\\n");
    process.exit(0);
  }
  process.stderr.write("npm error code E404\\n");
  process.exit(1);
}
if (args[0] === "view") {
  process.stdout.write("0.1.9\\n");
  process.exit(0);
}
if (args[0] === "publish") {
  if (process.env.PUBLISH_FAILS === "true") {
    process.stderr.write("publish failed\\n");
    process.exit(1);
  }
  process.exit(0);
}
process.stderr.write("unexpected npm invocation: " + args.join(" ") + "\\n");
process.exit(2);
`,
    );

    const result = runCommand(
      process.execPath,
      [path.join(root, ".github/scripts/publish-release.js")],
      {
        allowFailure: true,
        cwd: repository,
        env: {
          ...isolatedGitEnvironment,
          CEW_NPM_CLI: npmStub,
          EXACT_PUBLISHED: String(exactPublished),
          GITHUB_SHA: currentCommit,
          NPM_CALL_LOG: npmLog,
          PUBLISH_FAILS: String(publishFails),
        },
      },
    );
    const calls = fs.existsSync(npmLog)
      ? fs.readFileSync(npmLog, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
      : [];
    const localTag = git(
      ["-C", repository, "rev-list", "-n", "1", "v0.2.2"],
      { allowFailure: true },
    );
    const remoteTag = git(
      ["--git-dir", remote, "rev-list", "-n", "1", "v0.2.2"],
      { allowFailure: true },
    );

    return {
      calls,
      currentCommit,
      firstCommit,
      localTag: localTag.status === 0 ? localTag.stdout.trim() : "",
      remoteTag: remoteTag.status === 0 ? remoteTag.stdout.trim() : "",
      result,
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function checkReleaseRecoveryBehavior() {
  if (!exists(".github/scripts/publish-release.js")) {
    fail("release workflow must use an executable publish-release script");
    return;
  }

  const firstPublish = releaseScenario({});
  if (
    firstPublish.result.status !== 0 ||
    !firstPublish.calls.some(([command]) => command === "publish") ||
    firstPublish.remoteTag !== firstPublish.currentCommit
  ) {
    fail("release script must publish an absent version before creating its tag");
  }

  const failedPublish = releaseScenario({ publishFails: true });
  if (
    failedPublish.result.status === 0 ||
    failedPublish.localTag ||
    failedPublish.remoteTag
  ) {
    fail("release script must not create a tag when npm publish fails");
  }

  const publishedWithoutTag = releaseScenario({ exactPublished: true });
  if (
    publishedWithoutTag.result.status !== 0 ||
    publishedWithoutTag.calls.some(([command]) => command === "publish") ||
    publishedWithoutTag.remoteTag !== publishedWithoutTag.currentCommit
  ) {
    fail("release script must recreate a missing tag for an already published version");
  }

  const taggedWithoutPublish = releaseScenario({ tagAt: "current" });
  if (
    taggedWithoutPublish.result.status !== 0 ||
    !taggedWithoutPublish.calls.some(([command]) => command === "publish") ||
    taggedWithoutPublish.remoteTag !== taggedWithoutPublish.currentCommit
  ) {
    fail("release script must publish when the correct tag already exists");
  }

  const mismatchedTag = releaseScenario({ tagAt: "previous" });
  if (
    mismatchedTag.result.status === 0 ||
    mismatchedTag.calls.some(([command]) => command === "publish") ||
    mismatchedTag.remoteTag !== mismatchedTag.firstCommit
  ) {
    fail("release script must reject a tag that points to another commit");
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
    "node .github/scripts/publish-release.js",
  ]);

  requireTokens(".github/scripts/publish-release.js", [
    '["publish"]',
    '["push", "origin", tag]',
    "exactVersionIsPublished",
    "existingTagCommit",
    "CEW_NPM_CLI",
  ]);

  if (ci.includes("npm version \"$VERSION\"") || ci.includes("HEAD:main")) {
    fail("ci.yml must not rewrite or push main during publish");
  }
  if (ci.includes("npm publish") || ci.includes("git push origin")) {
    fail("ci.yml must delegate the release transaction to publish-release.js");
  }
  if (exists(".github/workflows/npm-publish.yml")) {
    fail("legacy npm-publish workflow must be removed");
  }
  checkReleaseRecoveryBehavior();

  requireTokens("README.md", [
    "npm 发布",
    "版本号通过 PR",
    "ci.yml",
    "受信任的发布商",
    "npm 发布成功后才创建",
  ]);
}

function checkLearningPathPolicy() {
  if (exists("homunculus")) {
    fail("repository should not contain removed homunculus directory");
  }

  const reviewScript = read("scripts/learning/review-confidence.js");
  const repositoryInstinctsLookup =
    /process\.cwd\(\)[\s\S]{0,120}["']homunculus["'][\s\S]{0,80}["']instincts["']/;
  if (repositoryInstinctsLookup.test(reviewScript)) {
    fail("review-confidence should not scan repository homunculus/instincts");
  }

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
  requireTokens("commands/learn.md", [
    "/learn eval",
    "/learn evolve",
    "skills/learn/<category>/",
    "候选证据来源",
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
    ["commands/code-review.md", ["skills/code-review/SKILL.md"]],
    ["commands/learn.md", ["skills/continuous-learning-v2/SKILL.md"]],
    ["commands/to-spec.md", ["skills/spec-gate/SKILL.md"]],
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

  const packageFiles = JSON.parse(read("package.json")).files ?? [];
  const publishesHomunculus = packageFiles.some((file) => {
    const normalized = file.replace(/\\/g, "/").replace(/^\.\//, "");
    return normalized === "homunculus" || normalized.startsWith("homunculus/");
  });
  if (publishesHomunculus) {
    fail("package.json should not publish removed homunculus directory");
  }

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

function runMetadataChecks(context) {
  bindContext(context);
  checkCommands();
  checkReadmeTreePaths();
  checkInstallRuntimePolicy();
  checkHookConfigReferences();
  checkGitHubWorkflows();
  checkLearningPathPolicy();
  checkSkillCategoryIndex();
  checkRouterTargets();
  checkNpmPackageSurface();
}

module.exports = { runMetadataChecks };
