"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

let root;
let rel;
let exists;
let read;
let managedFiles;
let fail;
let warn;
let requireTokens;
let isVerifierImplementation;

function bindContext(context) {
  ({
    root,
    rel,
    exists,
    read,
    managedFiles,
    fail,
    warn,
    requireTokens,
    isVerifierImplementation,
  } = context);
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
    "hooks/session-start.js",
    "hooks/session-end.js",
    "hooks/evaluate-session.js",
    "hooks/pre-compact.js",
    "hooks/runtime/session-utils.js",
  ]) {
    if (exists(legacyPath)) {
      fail(`${legacyPath} should not exist after script layout cleanup`);
    }
  }

  for (const requiredPath of [
    "hooks/runtime/run-with-flags.js",
    "hooks/runtime/hook-flags.js",
    "hooks/commit-quality.js",
    "hooks/check-console-log.js",
    "hooks/check-code-size.js",
    "scripts/learning/review-confidence.js",
    "scripts/learning/project-utils.js",
    "scripts/learning/projects.js",
    "scripts/learning/promote.js",
    "scripts/learning/migrate-homunculus.js",
    "scripts/merge-claude-settings.cjs",
  ]) {
    if (!exists(requiredPath)) {
      fail(`${requiredPath} is missing after script layout cleanup`);
    }
  }

  requireTokens("settings.json", [
    "hooks/runtime/run-with-flags.js",
    "hooks/check-console-log.js",
    "hooks/check-code-size.js",
    "hooks/commit-quality.js",
    "skills/continuous-learning-v2/hooks/observe-v2.js",
  ]);

  requireTokens("scripts/install.ps1", [
    "Remove-ObsoleteWorkflowPaths",
    "Remove-RetiredSkills",
    "Test-RetiredSkillManifest",
    "scripts\\hooks\\run-with-flags.js",
    "hooks\\review-confidence.js",
  ]);

  requireTokens("scripts/install.sh", [
    "remove_obsolete_workflow_paths",
    "cleanup_retired_skills",
    "validate_retired_skill_manifest",
    "scripts/hooks/run-with-flags.js",
    "hooks/review-confidence.js",
  ]);

  checkLegacyScriptReferences();
}

function checkLegacyScriptReferences() {
  for (const file of managedFiles()) {
    if (
      isVerifierImplementation(file) ||
      [
        "scripts/install.ps1",
        "scripts/install.sh",
        "scripts/merge-claude-settings.cjs",
      ].includes(file)
    ) continue;
    if (!/\.(md|json|js|ps1|sh)$/.test(file)) continue;

    const body = read(file);
    for (const forbidden of [
      "scripts/hooks/run-with-flags.js",
      "scripts/lib/hook-flags.js",
      "hooks/review-confidence.js",
      "hooks/session-start.js",
      "hooks/session-end.js",
      "hooks/evaluate-session.js",
      "hooks/pre-compact.js",
      "hooks/runtime/session-utils.js",
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
    "/learn projects",
    "/learn promote --dry-run",
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

  requireTokens("commands/learn.md", [
    "/learn projects",
    "scripts/learning/projects.js",
    "--register-current",
    "/learn promote",
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

function createRetiredSkillFixture() {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cew-retired-skill-cleanup-"),
  );
  const at = (...parts) => path.join(tempRoot, ...parts);
  const fixture = {
    tempRoot,
    known: at("skills", "brainstorming", "SKILL.md"),
    unknown: at("skills", "brainstorming", "user-notes.md"),
    dryRunKnown: at("skills", "discover-unknowns-zh", "SKILL.md"),
    creatorKnown: at("skills", "skill-creator", "scripts", "quick_validate.py"),
    creatorUnknown: at("skills", "skill-creator", "user-template.md"),
    nestedSymlink: at("skills", "brainstorming", "scripts"),
    nestedExternalKnown: at("outside-nested-directory", "helper.js"),
    rootSymlinkInstall: at("root-symlink-install"),
    rootSymlink: at(
      "root-symlink-install",
      "skills",
      "discover-unknowns-zh",
    ),
    rootExternalKnown: at("outside-retired-skill", "SKILL.md"),
    leafSymlinkInstall: at("leaf-symlink-install"),
    leafSymlink: at(
      "leaf-symlink-install",
      "skills",
      "discover-unknowns-zh",
      "SKILL.md",
    ),
    leafExternalKnown: at("outside-leaf-symlink", "SKILL.md"),
    permissionInstall: at("permission-install"),
    permissionSkillsRoot: at("permission-install", "skills"),
    testLeafSymlink: process.platform !== "win32",
  };

  for (const file of [
    fixture.known,
    fixture.unknown,
    fixture.dryRunKnown,
    fixture.creatorKnown,
    fixture.creatorUnknown,
  ]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "fixture");
  }
  fs.mkdirSync(path.dirname(fixture.rootExternalKnown), { recursive: true });
  fs.writeFileSync(fixture.rootExternalKnown, "must stay");
  fs.mkdirSync(path.dirname(fixture.rootSymlink), { recursive: true });
  fs.symlinkSync(
    path.dirname(fixture.rootExternalKnown),
    fixture.rootSymlink,
    process.platform === "win32" ? "junction" : "dir",
  );
  fs.mkdirSync(path.dirname(fixture.nestedSymlink), { recursive: true });
  fs.mkdirSync(path.dirname(fixture.nestedExternalKnown), { recursive: true });
  fs.writeFileSync(fixture.nestedExternalKnown, "must also stay");
  fs.symlinkSync(
    path.dirname(fixture.nestedExternalKnown),
    fixture.nestedSymlink,
    process.platform === "win32" ? "junction" : "dir",
  );
  if (fixture.testLeafSymlink) {
    fs.mkdirSync(path.dirname(fixture.leafSymlink), { recursive: true });
    fs.mkdirSync(path.dirname(fixture.leafExternalKnown), { recursive: true });
    fs.writeFileSync(fixture.leafExternalKnown, "must stay linked");
    fs.symlinkSync(fixture.leafExternalKnown, fixture.leafSymlink, "file");
  }
  fs.mkdirSync(fixture.permissionSkillsRoot, { recursive: true });
  return fixture;
}

function runRetiredSkillCleanup(cleanup, args) {
  return spawnSync(process.execPath, [cleanup, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
  });
}

function isSymlink(file) {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function assertRetiredSkillCleanup(fixture) {
  if (
    fs.existsSync(fixture.known) ||
    fs.existsSync(fixture.dryRunKnown) ||
    fs.existsSync(fixture.creatorKnown)
  ) {
    fail("retired skill cleanup did not remove known files");
  }
  if (
    !fs.existsSync(fixture.unknown) ||
    !fs.existsSync(fixture.creatorUnknown)
  ) {
    fail("retired skill cleanup removed an unknown user file");
  }
  if (
    !fs.existsSync(fixture.rootExternalKnown) ||
    !isSymlink(fixture.rootSymlink)
  ) {
    fail("retired skill cleanup followed a symlinked skill directory");
  }
  if (
    !fs.existsSync(fixture.nestedExternalKnown) ||
    !isSymlink(fixture.nestedSymlink)
  ) {
    fail("retired skill cleanup followed a nested directory symlink");
  }
  const leafSymlinkPreserved =
    !fixture.testLeafSymlink ||
    (
      fs.existsSync(fixture.leafExternalKnown) &&
      isSymlink(fixture.leafSymlink)
    );
  if (!leafSymlinkPreserved) {
    fail("retired skill cleanup removed a leaf symlink");
  }
}

function checkPermissionFailure(cleanup, fixture) {
  if (process.platform === "win32") return;

  fs.chmodSync(fixture.permissionInstall, 0o000);
  try {
    const result = runRetiredSkillCleanup(cleanup, [
      fixture.permissionInstall,
    ]);
    if (result.status === 0) {
      fail("retired skill cleanup ignored an inaccessible install root");
    }
  } finally {
    fs.chmodSync(fixture.permissionInstall, 0o700);
  }
}

function checkRetiredSkillCleanup() {
  const cleanup = rel("scripts/cleanup-retired-skills.js");
  const manifest = rel("scripts/retired-skill-files.json");
  if (!fs.existsSync(cleanup)) return fail("retired skill cleanup script is missing");
  if (!fs.existsSync(manifest)) return fail("retired skill manifest is missing");

  const fixture = createRetiredSkillFixture();
  try {
    const validation = runRetiredSkillCleanup(cleanup, ["--validate"]);
    if (validation.status !== 0) {
      fail(`retired skill manifest validation failed: ${validation.stderr}`);
    }

    const dryRun = runRetiredSkillCleanup(cleanup, [
      fixture.tempRoot,
      "--dry-run",
    ]);
    if (dryRun.status !== 0) {
      fail(`retired skill cleanup dry-run failed: ${dryRun.stderr}`);
    }
    if (!dryRun.stdout.includes("Preserve unknown retired skill path")) {
      fail("retired skill cleanup dry-run did not report preserved unknown files");
    }
    if (
      !fs.existsSync(fixture.known) ||
      !fs.existsSync(fixture.dryRunKnown) ||
      !fs.existsSync(fixture.creatorKnown)
    ) {
      fail("retired skill cleanup dry-run modified files");
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const result = runRetiredSkillCleanup(cleanup, [fixture.tempRoot]);
      if (result.status !== 0) {
        fail(`retired skill cleanup attempt ${attempt} failed: ${result.stderr}`);
      }
    }
    const rootSymlink = runRetiredSkillCleanup(cleanup, [
      fixture.rootSymlinkInstall,
    ]);
    if (rootSymlink.status !== 0) {
      fail(`retired skill root symlink cleanup failed: ${rootSymlink.stderr}`);
    }
    if (fixture.testLeafSymlink) {
      const leafSymlink = runRetiredSkillCleanup(cleanup, [
        fixture.leafSymlinkInstall,
      ]);
      if (leafSymlink.status !== 0) {
        fail(`retired skill leaf symlink cleanup failed: ${leafSymlink.stderr}`);
      }
    }
    checkPermissionFailure(cleanup, fixture);
    assertRetiredSkillCleanup(fixture);
  } finally {
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
}

function checkUpstreamCapabilityVerifier() {
  const verifier = rel("scripts/verify-upstream-capability-map.js");
  const baseline = rel("scripts/upstream-capability-baseline.json");
  if (!fs.existsSync(verifier)) {
    fail("upstream capability verifier is missing");
    return;
  }
  if (!fs.existsSync(baseline)) {
    fail("upstream capability baseline is missing");
    return;
  }
  const result = spawnSync(process.execPath, [verifier], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
  });
  if (result.error) {
    fail(`upstream capability verifier failed: ${result.error.message}`);
  } else if (result.status !== 0) {
    fail(`upstream capability verifier exited ${result.status}: ${result.stderr}`);
  }
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

function runRuntimeChecks(context) {
  bindContext(context);
  checkScriptLayout();
  checkContinuousLearningV21();
  checkObserveV2();
  checkRetiredSkillCleanup();
  checkUpstreamCapabilityVerifier();
  checkGitDiffWhitespace();
}

module.exports = { runRuntimeChecks };
