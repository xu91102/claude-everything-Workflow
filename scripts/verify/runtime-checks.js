"use strict";

const fs = require("fs");
const crypto = require("crypto");
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
    "scripts\\hooks\\run-with-flags.js",
    "hooks\\review-confidence.js",
  ]);

  requireTokens("scripts/install.sh", [
    "remove_obsolete_workflow_paths",
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
        "scripts/preflight-install-paths.js",
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

function createRetiredSkillFixture() {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cew-retired-skill cleanup-"),
  );
  const at = (...parts) => path.join(tempRoot, ...parts);
  const fixture = {
    tempRoot,
    unknown: at("skills", "brainstorming", "user-notes.md"),
    symlinkRoot: at("skills", "find-skills"),
    externalKnown: at("outside-retired-skill", "SKILL.md"),
    nestedSymlinkRoot: at("skills", "brainstorming", "custom-references"),
    nestedExternalKnown: at(
      "outside-nested-directory",
      "output-patterns.md",
    ),
    activeCurrent: at(
      "skills",
      "subagent-driven-development",
      "references",
      "implementer-prompt.md",
    ),
  };
  for (const file of [
    fixture.unknown,
    fixture.activeCurrent,
  ]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "fixture");
  }
  fs.mkdirSync(path.dirname(fixture.externalKnown), { recursive: true });
  fs.writeFileSync(fixture.externalKnown, "must stay");
  fs.symlinkSync(
    path.dirname(fixture.externalKnown),
    fixture.symlinkRoot,
    process.platform === "win32" ? "junction" : "dir",
  );
  fs.mkdirSync(path.dirname(fixture.nestedSymlinkRoot), { recursive: true });
  fs.mkdirSync(path.dirname(fixture.nestedExternalKnown), { recursive: true });
  fs.writeFileSync(fixture.nestedExternalKnown, "must also stay");
  fs.symlinkSync(
    path.dirname(fixture.nestedExternalKnown),
    fixture.nestedSymlinkRoot,
    process.platform === "win32" ? "junction" : "dir",
  );
  return fixture;
}

function runRetiredSkillCleanup(cleanup, args) {
  return spawnSync(process.execPath, [cleanup, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
  });
}

function assertRetiredSkillCleanup(fixture) {
  if (!fs.existsSync(fixture.unknown)) {
    fail("retired skill cleanup removed an unknown user file");
  }
  if (!fs.existsSync(fixture.activeCurrent)) {
    fail("retired skill cleanup removed a current SDD file");
  }
  if (
    !fs.existsSync(fixture.externalKnown) ||
    !fs.lstatSync(fixture.symlinkRoot).isSymbolicLink()
  ) {
    fail("retired skill cleanup followed a symlink outside the retired directory");
  }
  if (
    !fs.existsSync(fixture.nestedExternalKnown) ||
    !fs.lstatSync(fixture.nestedSymlinkRoot).isSymbolicLink()
  ) {
    fail("retired skill cleanup followed a nested directory symlink");
  }
}

function checkRetiredSkillCleanup() {
  const cleanup = rel("scripts/cleanup-retired-skills.js");
  const manifest = rel("scripts/retired-skill-files.json");
  if (!fs.existsSync(cleanup)) return fail("retired skill cleanup script is missing");
  if (!fs.existsSync(manifest)) return fail("retired skill manifest is missing");
  const fixture = createRetiredSkillFixture();
  const validation = spawnSync(process.execPath, [cleanup, "--validate"], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
  });
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
  if (!fs.existsSync(fixture.unknown) || !fs.existsSync(fixture.activeCurrent)) {
    fail("retired skill cleanup dry-run modified files");
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = runRetiredSkillCleanup(cleanup, [fixture.tempRoot]);
    if (result.status !== 0) {
      fail(`retired skill cleanup attempt ${attempt} failed: ${result.stderr}`);
    }
  }
  assertRetiredSkillCleanup(fixture);
  fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
}

function assertKnownRetiredCleanup(fixture) {
  const result = spawnSync(
    process.execPath,
    [fixture.cleanup, fixture.knownRoot, "--manifest", fixture.manifest],
    { cwd: root, encoding: "utf8", timeout: 10000 },
  );
  if (result.status !== 0 || fs.existsSync(fixture.knownFile)) {
    fail(`known retired file was not safely removed: ${result.stderr}${result.stdout}`);
  }
}

function assertCustomizedRetiredCleanup(fixture) {
  const result = spawnSync(
    process.execPath,
    [fixture.cleanup, fixture.customRoot, "--manifest", fixture.manifest],
    { cwd: root, encoding: "utf8", timeout: 10000 },
  );
  const backups = fs
    .readdirSync(path.dirname(fixture.customFile))
    .filter((name) => name.startsWith("SKILL.md.retired-backup-"));
  if (
    result.status !== 3 ||
    !fs.existsSync(fixture.customFile) ||
    backups.length !== 1
  ) {
    fail(`customized retired file was not preserved: ${result.stderr}${result.stdout}`);
  }
}

function assertRetiredBackupCollision(fixture) {
  const result = spawnSync(
    process.execPath,
    [fixture.cleanup, fixture.collisionRoot, "--manifest", fixture.manifest],
    { cwd: root, encoding: "utf8", timeout: 10000 },
  );
  if (
    result.status === 0 ||
    fs.readFileSync(fixture.collisionFile, "utf8") !== fixture.collisionContent ||
    fs.readFileSync(fixture.collisionBackup, "utf8") !== "unrelated collision\n"
  ) {
    fail(`retired cleanup accepted an unsafe backup collision: ${result.stderr}${result.stdout}`);
  }
}

function createHashAwareCleanupFixture() {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cew-hash-aware-cleanup-"),
  );
  const cleanup = rel("scripts/cleanup-retired-skills.js");
  const manifest = path.join(tempRoot, "retired-files.json");
  const knownRoot = path.join(tempRoot, "known-install");
  const customRoot = path.join(tempRoot, "custom-install");
  const collisionRoot = path.join(tempRoot, "collision-install");
  const relative = path.join("skills", "legacy-skill", "SKILL.md");
  const knownFile = path.join(knownRoot, relative);
  const customFile = path.join(customRoot, relative);
  const collisionFile = path.join(collisionRoot, relative);
  const knownContent = "distributed legacy skill\n";
  const knownHash = crypto
    .createHash("sha256")
    .update(knownContent)
    .digest("hex");

  fs.mkdirSync(path.dirname(knownFile), { recursive: true });
  fs.mkdirSync(path.dirname(customFile), { recursive: true });
  fs.mkdirSync(path.dirname(collisionFile), { recursive: true });
  fs.writeFileSync(knownFile, knownContent);
  fs.writeFileSync(customFile, "user customized legacy skill\n");
  const collisionContent = "customized collision source\n";
  const collisionDigest = crypto
    .createHash("sha256")
    .update(collisionContent)
    .digest("hex");
  const collisionBackup = `${collisionFile}.retired-backup-${collisionDigest.slice(0, 12)}`;
  fs.writeFileSync(collisionFile, collisionContent);
  fs.writeFileSync(collisionBackup, "unrelated collision\n");
  fs.writeFileSync(
    manifest,
    JSON.stringify(
      {
        version: 2,
        retired_skills: {
          "legacy-skill": [
            { path: "SKILL.md", sha256: [knownHash] },
          ],
        },
        stale_skill_files: {},
      },
      null,
      2,
    ),
  );
  return {
    cleanup,
    collisionBackup,
    collisionContent,
    collisionFile,
    collisionRoot,
    customFile,
    customRoot,
    knownFile,
    knownRoot,
    manifest,
    tempRoot,
  };
}

function checkHashAwareRetiredCleanup() {
  const fixture = createHashAwareCleanupFixture();
  assertKnownRetiredCleanup(fixture);
  assertCustomizedRetiredCleanup(fixture);
  assertRetiredBackupCollision(fixture);
  fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
}

function checkInstallerSymlinkPreflight() {
  if (process.platform === "win32") return;

  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cew-installer-preflight-"),
  );
  const fakeHome = path.join(tempRoot, "home");
  const installRoot = path.join(fakeHome, ".claude");
  const external = path.join(tempRoot, "external-skills");
  fs.mkdirSync(installRoot, { recursive: true });
  fs.mkdirSync(external, { recursive: true });
  fs.symlinkSync(external, path.join(installRoot, "skills"), "dir");

  const result = spawnSync("bash", [rel("scripts/install.sh"), "--claude-only"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: fakeHome,
      USERPROFILE: fakeHome,
    },
    timeout: 30000,
  });
  const externalEntries = fs.readdirSync(external);
  if (
    result.status === 0 ||
    externalEntries.length !== 0 ||
    !`${result.stdout}${result.stderr}`.toLowerCase().includes("symlink")
  ) {
    fail(
      `installer wrote before rejecting a symlinked target: ${result.stderr}${result.stdout}`,
    );
  }

  const rootLinkHome = path.join(tempRoot, "root-link-home");
  const externalRoot = path.join(tempRoot, "external-install-root");
  fs.mkdirSync(rootLinkHome, { recursive: true });
  fs.mkdirSync(externalRoot, { recursive: true });
  fs.symlinkSync(externalRoot, path.join(rootLinkHome, ".claude"), "dir");
  const rootLinkResult = runBashInstaller(rootLinkHome, ["--claude-only"]);
  if (
    rootLinkResult.status === 0 ||
    fs.readdirSync(externalRoot).length !== 0 ||
    !`${rootLinkResult.stdout}${rootLinkResult.stderr}`
      .toLowerCase()
      .includes("symlink")
  ) {
    fail(
      `installer wrote before rejecting a symlinked install root: ${rootLinkResult.stderr}${rootLinkResult.stdout}`,
    );
  }

  const danglingHome = path.join(tempRoot, "dangling-home");
  const danglingRoot = path.join(danglingHome, ".claude");
  fs.mkdirSync(danglingRoot, { recursive: true });
  fs.symlinkSync(
    path.join(tempRoot, "missing-skills-target"),
    path.join(danglingRoot, "skills"),
    "dir",
  );
  const danglingResult = runBashInstaller(danglingHome, ["--claude-only"]);
  if (
    danglingResult.status === 0 ||
    fs.existsSync(path.join(danglingRoot, "AGENTS.md")) ||
    !`${danglingResult.stdout}${danglingResult.stderr}`
      .toLowerCase()
      .includes("symlink")
  ) {
    fail(
      `installer wrote before rejecting a dangling target symlink: ${danglingResult.stderr}${danglingResult.stdout}`,
    );
  }

  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function runBashInstaller(fakeHome, args = []) {
  return spawnSync("bash", [rel("scripts/install.sh"), ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: fakeHome,
      USERPROFILE: fakeHome,
    },
    timeout: 30000,
  });
}

function checkInstallerTargetOnlyPreflight() {
  if (process.platform === "win32") return;

  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cew-target-only-preflight-"),
  );
  const fakeHome = path.join(tempRoot, "home");
  const installRoot = path.join(fakeHome, ".claude");
  const external = path.join(tempRoot, "external-obsolete");
  fs.mkdirSync(path.join(installRoot, "scripts"), { recursive: true });
  fs.mkdirSync(external, { recursive: true });
  fs.writeFileSync(path.join(external, "run-with-flags.js"), "must stay");
  fs.symlinkSync(external, path.join(installRoot, "scripts", "hooks"), "dir");

  const result = runBashInstaller(fakeHome, ["--claude-only"]);
  if (
    result.status === 0 ||
    !fs.existsSync(path.join(external, "run-with-flags.js")) ||
    !`${result.stdout}${result.stderr}`.toLowerCase().includes("symlink")
  ) {
    fail(
      `installer missed a target-only obsolete symlink: ${result.stderr}${result.stdout}`,
    );
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function checkInstallerGlobalPreflight() {
  if (process.platform === "win32") return;

  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cew-global-preflight-"),
  );
  const fakeHome = path.join(tempRoot, "home");
  const codexRoot = path.join(fakeHome, ".codex");
  const external = path.join(tempRoot, "external-codex-skills");
  fs.mkdirSync(codexRoot, { recursive: true });
  fs.mkdirSync(external, { recursive: true });
  fs.symlinkSync(external, path.join(codexRoot, "skills"), "dir");

  const result = runBashInstaller(fakeHome);
  if (
    result.status === 0 ||
    fs.existsSync(path.join(fakeHome, ".claude")) ||
    fs.readdirSync(external).length !== 0
  ) {
    fail(
      `installer wrote one target before global preflight completed: ${result.stderr}${result.stdout}`,
    );
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function checkActiveCustomizedBackup(tempRoot) {
  const activeHome = path.join(tempRoot, "active-home");
  const activeSkill = path.join(
    activeHome,
    ".claude",
    "skills",
    "using-superpowers",
    "SKILL.md",
  );
  fs.mkdirSync(path.dirname(activeSkill), { recursive: true });
  fs.writeFileSync(activeSkill, "user customized active skill\n");
  const activeResult = runBashInstaller(activeHome, ["--claude-only"]);
  const activeBackups = fs
    .readdirSync(path.dirname(activeSkill))
    .filter((name) => name.startsWith("SKILL.md.distribution-backup-"));
  if (activeResult.status !== 0 || activeBackups.length !== 1) {
    fail(
      `installer did not back up a customized active file: ${activeResult.stderr}${activeResult.stdout}`,
    );
  }
}

function checkActiveBackupCollision(tempRoot) {
  const collisionHome = path.join(tempRoot, "backup-collision-home");
  const collisionSkill = path.join(
    collisionHome,
    ".claude",
    "skills",
    "using-superpowers",
    "SKILL.md",
  );
  const collisionContent = "another customized active skill\n";
  const collisionDigest = crypto
    .createHash("sha256")
    .update(collisionContent)
    .digest("hex");
  const collisionBackup = `${collisionSkill}.distribution-backup-${collisionDigest.slice(0, 12)}`;
  const collisionSentinel = path.join(collisionHome, ".claude", "AGENTS.md");
  fs.mkdirSync(path.dirname(collisionSkill), { recursive: true });
  fs.writeFileSync(collisionSkill, collisionContent);
  fs.writeFileSync(collisionBackup, "unrelated collision\n");
  fs.writeFileSync(collisionSentinel, "must remain before global preflight\n");
  const collisionResult = runBashInstaller(collisionHome, ["--claude-only"]);
  if (
    collisionResult.status === 0 ||
    fs.readFileSync(collisionSkill, "utf8") !== collisionContent ||
    fs.readFileSync(collisionSentinel, "utf8") !==
      "must remain before global preflight\n"
  ) {
    fail(
      "installer overwrote a customized file after backup collision: " +
        `${collisionResult.stderr}${collisionResult.stdout}`,
    );
  }
}

function checkConfigBackupCollision(tempRoot) {
  const configCollisionHome = path.join(tempRoot, "config-collision-home");
  const configRoot = path.join(configCollisionHome, ".claude");
  const configTarget = path.join(configRoot, "AGENTS.md");
  const configContent = "custom root instructions\n";
  const configDigest = crypto
    .createHash("sha256")
    .update(configContent)
    .digest("hex");
  const externalBackup = path.join(tempRoot, "external-config-backup");
  const externalSentinel = path.join(externalBackup, "sentinel");
  fs.mkdirSync(configRoot, { recursive: true });
  fs.mkdirSync(externalBackup, { recursive: true });
  fs.writeFileSync(configTarget, configContent);
  fs.writeFileSync(externalSentinel, "external sentinel\n");
  fs.symlinkSync(
    externalBackup,
    `${configTarget}.distribution-backup-${configDigest.slice(0, 12)}`,
    "dir",
  );
  const configCollisionResult = runBashInstaller(configCollisionHome, [
    "--claude-only",
  ]);
  if (
    configCollisionResult.status === 0 ||
    fs.readFileSync(configTarget, "utf8") !== configContent ||
    fs.readFileSync(externalSentinel, "utf8") !== "external sentinel\n"
  ) {
    fail(
      "installer accepted an unsafe top-level backup collision: " +
        `${configCollisionResult.stderr}${configCollisionResult.stdout}`,
    );
  }
}

function checkRetiredConflictRetry(tempRoot) {
  const retiredHome = path.join(tempRoot, "retired-home");
  const retiredRoot = path.join(retiredHome, ".claude");
  const sentinel = path.join(retiredRoot, "AGENTS.md");
  const retiredSkill = path.join(
    retiredRoot,
    "skills",
    "brainstorming",
    "SKILL.md",
  );
  fs.mkdirSync(path.dirname(retiredSkill), { recursive: true });
  fs.writeFileSync(sentinel, "do not replace before retirement decision\n");
  fs.writeFileSync(retiredSkill, "user customized retired skill\n");
  const retiredResult = runBashInstaller(retiredHome, ["--claude-only"]);
  const retiredBackups = fs
    .readdirSync(path.dirname(retiredSkill))
    .filter((name) => name.startsWith("SKILL.md.retired-backup-"));
  if (
    retiredResult.status !== 3 ||
    fs.readFileSync(sentinel, "utf8") !==
      "do not replace before retirement decision\n" ||
    fs.readFileSync(retiredSkill, "utf8") !==
      "user customized retired skill\n" ||
    retiredBackups.length !== 1
  ) {
    fail(
      `installer did not stop before merging a customized retired file: ${retiredResult.stderr}${retiredResult.stdout}`,
    );
  }

  fs.rmSync(retiredSkill);
  const retryResult = runBashInstaller(retiredHome, ["--claude-only"]);
  if (
    retryResult.status !== 0 ||
    !fs.existsSync(
      path.join(
        retiredHome,
        ".claude",
        "skills",
        "using-superpowers",
        "SKILL.md",
      ),
    ) ||
    retiredBackups.some(
      (name) => !fs.existsSync(path.join(path.dirname(retiredSkill), name)),
    )
  ) {
    fail(
      `installer could not retry after a preserved retired-file conflict: ${retryResult.stderr}${retryResult.stdout}`,
    );
  }
}

function checkInstallerCustomizedFiles() {
  if (process.platform === "win32") return;

  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cew-customized-install-"),
  );
  checkActiveCustomizedBackup(tempRoot);
  checkActiveBackupCollision(tempRoot);
  checkConfigBackupCollision(tempRoot);
  checkRetiredConflictRetry(tempRoot);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function checkPublishedUpgradeLifecycle() {
  if (process.platform === "win32") return;

  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cew-published-upgrade-"),
  );
  const fakeHome = path.join(tempRoot, "upgrade home");
  const retiredMetadata = path.join(
    fakeHome,
    ".claude",
    "skills",
    "brainstorming",
    "agents",
    "openai.yaml",
  );
  fs.mkdirSync(path.dirname(retiredMetadata), { recursive: true });
  fs.writeFileSync(
    retiredMetadata,
    [
      "interface:",
      '  display_name: "Brainstorming"',
      '  short_description: "Explore intent, requirements, and design before implementation"',
      "",
    ].join("\n"),
  );

  const result = runBashInstaller(fakeHome, ["--claude-only"]);
  if (
    result.status !== 0 ||
    fs.existsSync(retiredMetadata) ||
    !fs.existsSync(
      path.join(
        fakeHome,
        ".claude",
        "skills",
        "using-superpowers",
        "SKILL.md",
      ),
    )
  ) {
    fail(
      `installer could not upgrade the published 0.1.9 retirement baseline: ${result.stderr}${result.stdout}`,
    );
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function checkBashInstallerLifecycle() {
  if (process.platform === "win32") return;

  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cew 安装 lifecycle-"),
  );
  const fakeHome = path.join(tempRoot, "home with spaces");
  fs.mkdirSync(fakeHome, { recursive: true });
  const first = runBashInstaller(fakeHome, ["--claude-only"]);
  const installed = path.join(
    fakeHome,
    ".claude",
    "skills",
    "using-superpowers",
    "SKILL.md",
  );
  if (first.status !== 0 || !fs.existsSync(installed)) {
    fail(`clean Bash install failed: ${first.stderr}${first.stdout}`);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    return;
  }

  const unknown = path.join(
    fakeHome,
    ".claude",
    "skills",
    "writing-plans",
    "user-notes.md",
  );
  fs.writeFileSync(unknown, "keep me");
  const second = runBashInstaller(fakeHome, ["--claude-only"]);
  if (second.status !== 0 || !fs.existsSync(unknown)) {
    fail(`repeated Bash install was not idempotent: ${second.stderr}${second.stdout}`);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function checkPublishedRetirementBaseline() {
  const baselines = JSON.parse(
    fs.readFileSync(rel("scripts/published-retirement-baselines.json"), "utf8"),
  );
  const manifest = JSON.parse(
    fs.readFileSync(rel("scripts/retired-skill-files.json"), "utf8"),
  );
  if (baselines.schema_version !== 1 || baselines.packages.length === 0) {
    fail("published retirement baseline is invalid");
    return;
  }
  for (const published of baselines.packages) {
    if (!published.dist_shasum || !published.dist_integrity) {
      fail(`${published.package}@${published.version} lacks npm provenance`);
    }
    for (const [relative, digest] of Object.entries(published.retired_files)) {
      const parts = relative.split("/");
      if (parts[0] !== "skills") {
        fail(`published retirement path is outside skills: ${relative}`);
        continue;
      }
      const skill = parts[1];
      const file = parts.slice(2).join("/");
      const known = manifest.retired_skills[skill]?.find(
        (entry) => entry.path === file,
      );
      if (!known?.sha256.includes(digest)) {
        fail(
          `${published.package}@${published.version} hash is not recognized: ${relative}`,
        );
      }
    }
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
  checkHashAwareRetiredCleanup();
  checkInstallerSymlinkPreflight();
  checkInstallerTargetOnlyPreflight();
  checkInstallerGlobalPreflight();
  checkInstallerCustomizedFiles();
  checkPublishedUpgradeLifecycle();
  checkBashInstallerLifecycle();
  checkPublishedRetirementBaseline();
  checkGitDiffWhitespace();
}

module.exports = { runRuntimeChecks };
