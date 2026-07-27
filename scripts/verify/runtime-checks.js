"use strict";

const fs = require("fs");
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
  checkGitDiffWhitespace();
}

module.exports = { runRuntimeChecks };
