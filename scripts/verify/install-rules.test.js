"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { installRules, finalizeBackups, BACKUP_ROOT_NAME } = require("../install-rules");
const { installAntigravity, parseFrontmatter, mapTools } = require("../install-antigravity");

const sourceRoot = path.resolve(__dirname, "../..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cew-rules-"));
const read = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const messages = [];
const install = (name, host = "claude-code", dryRun = false) => installRules({
  sourceRoot, installRoot: path.join(tempRoot, name), host, dryRun,
  log: (message) => messages.push(message),
});

function checkLegacyMigration() {
  const fixture = path.join(tempRoot, "legacy-source");
  fs.mkdirSync(path.join(fixture, "rules/common"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "scripts"));
  fs.writeFileSync(path.join(fixture, "rules/common/testing.md"), "Current distribution\n");
  const previous = "Previous distribution\n";
  const hash = crypto.createHash("sha256").update(previous).digest("hex");
  fs.writeFileSync(path.join(fixture, "rules/02-implementation.md"), "New resident distribution\n");
  fs.writeFileSync(path.join(fixture, "scripts/legacy-common-rule-hashes.json"),
    JSON.stringify({ files: { "common/testing.md": [hash], "02-implementation.md": [hash] } }));
  const target = path.join(tempRoot, "legacy-target");
  fs.mkdirSync(path.join(target, "rules/common"), { recursive: true });
  fs.writeFileSync(path.join(target, "rules/common/testing.md"), previous.replace(/\n/g, "\r\n"));
  const options = { sourceRoot: fixture, installRoot: target, host: "claude-code", log: () => {} };
  installRules({ ...options, dryRun: true });
  assert.equal(read(path.join(target, "rules/common/testing.md")), previous);
  assert.equal(fs.existsSync(path.join(target, "references")), false);
  installRules(options);
  assert.equal(fs.existsSync(path.join(target, "rules/common/testing.md")), false);
  assert.equal(read(path.join(target, "references/rules/common/testing.md")), "Current distribution\n");

  const previousReference = path.join(target, "references/rules/02-implementation.md");
  fs.writeFileSync(previousReference, previous.replace(/\n/g, "\r\n"));
  fs.unlinkSync(path.join(target, "rules/02-implementation.md"));
  const cold = path.join(target, "references/rules/common/testing.md");
  fs.writeFileSync(cold, previous);
  installRules({ ...options, backupId: "20261125100000" });
  assert.equal(read(cold), "Current distribution\n");
  assert.equal(read(path.join(target, "rules/02-implementation.md")), "New resident distribution\n");
  assert.equal(fs.existsSync(previousReference), false);
  assert.equal(
    read(path.join(target, BACKUP_ROOT_NAME, "20261125100000/references/rules/common/testing.md")),
    previous,
  );
  assert.equal(fs.existsSync(cold + ".bak." + hash), false);

  // Legacy inline .bak.* files and older backup directories are cleaned on finalizeBackups.
  fs.writeFileSync(path.join(target, "AGENTS.md.bak.20260101000000"), "old top backup\n");
  fs.writeFileSync(path.join(target, "rules/01-base.md.bak.deadbeef"), "old rule backup\n");
  fs.writeFileSync(cold + ".bak." + hash, previous);
  const olderSnapshot = path.join(target, BACKUP_ROOT_NAME, "20261124000000");
  fs.mkdirSync(path.join(olderSnapshot, "references/rules/common"), { recursive: true });
  fs.writeFileSync(path.join(olderSnapshot, "references/rules/common/testing.md"), "Superseded backup\n");
  fs.writeFileSync(path.join(target, BACKUP_ROOT_NAME, "20261124000000/AGENTS.md"), "older\n");
  finalizeBackups({ installRoot: target, dryRun: true, log: () => {} });
  assert.equal(read(path.join(olderSnapshot, "references/rules/common/testing.md")), "Superseded backup\n");
  finalizeBackups({ installRoot: target, log: () => {} });
  assert.equal(fs.existsSync(path.join(olderSnapshot, "references")), false);
  assert.equal(read(path.join(target, BACKUP_ROOT_NAME, "20261125100000/references/rules/common/testing.md")), previous);
  assert.equal(fs.existsSync(path.join(target, "AGENTS.md.bak.20260101000000")), false);
  assert.equal(fs.existsSync(path.join(target, "rules/01-base.md.bak.deadbeef")), false);
  assert.equal(fs.existsSync(cold + ".bak." + hash), false);
  const backups = path.join(target, BACKUP_ROOT_NAME);
  assert.equal(read(path.join(backups, "legacy/AGENTS.md.bak.20260101000000")), "old top backup\n");
  assert.equal(read(path.join(backups, "legacy/rules/01-base.md.bak.deadbeef")), "old rule backup\n");
  assert.equal(read(path.join(backups, "20261124000000/AGENTS.md")), "older\n",
    "a later partial backup must preserve the only copy of each unchanged file");
}

function checkPromotedImplementationRule() {
  const filename = "02-implementation.md";
  const target = path.join(tempRoot, "promoted");
  const cold = path.join(target, "references/rules", filename);
  const resident = path.join(target, "rules", filename);
  const custom = "My implementation policy\r\n";
  fs.mkdirSync(path.dirname(cold), { recursive: true });
  fs.writeFileSync(cold, custom);
  install("promoted", "claude-code", true);
  assert.equal(fs.existsSync(resident), false);
  assert.equal(fs.readFileSync(cold, "utf8"), custom);
  install("promoted");
  assert.equal(fs.readFileSync(resident, "utf8"), custom, "promote personal rules byte-for-byte");
  install("promoted");
  assert.equal(fs.readFileSync(resident, "utf8"), custom, "preserve promoted rules on reinstall");
  assert.equal(fs.existsSync(cold), false);

  fs.writeFileSync(cold, "Separate personal reference\n");
  install("promoted");
  assert.equal(fs.readFileSync(resident, "utf8"), custom, "existing personal resident rules take priority");
  assert.equal(read(cold), "Separate personal reference\n", "preserve conflicting personal copies");

  fs.copyFileSync(path.join(sourceRoot, "rules", filename), resident);
  install("promoted");
  assert.equal(read(resident), "Separate personal reference\n", "repair a previously shadowed policy");
  assert.equal(fs.existsSync(cold), false);
}

function checkCodexImplementationRuleUpgrades() {
  const fixture = path.join(tempRoot, "codex-release");
  const target = path.join(tempRoot, "codex-existing");
  const filename = "02-implementation.md";
  const source = path.join(fixture, "rules", filename);
  const active = path.join(target, "rules", filename);
  const old = "Original release\n";
  const initial = "# Implementation\nScope: fix bugs.\n\n# Checks\nRun unit tests.\n";
  const personal = initial.replace("fix bugs.", "fix bugs. Leave unrelated work alone.").replace(/\n/g, "\r\n");
  const updated = initial.replace("unit tests", "unit and integration tests");
  const base = path.join(target, ".cew-rule-state", "02-implementation.base.md");
  const incoming = path.join(target, ".cew-rule-state", "02-implementation.incoming.md");
  const run = (dryRun = false) => installRules({
    sourceRoot: fixture, installRoot: target, host: "codex", dryRun, log: () => {},
  });
  fs.mkdirSync(path.dirname(active), { recursive: true });
  fs.mkdirSync(path.join(fixture, "rules/common"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "scripts"));
  const oldHash = crypto.createHash("sha256").update(old).digest("hex");
  fs.writeFileSync(path.join(fixture, "scripts/legacy-common-rule-hashes.json"),
    JSON.stringify({ files: { [filename]: [oldHash] } }));
  fs.writeFileSync(source, initial);
  fs.writeFileSync(active, personal);
  run(true);
  assert.deepEqual(fs.readdirSync(target), ["rules"], "dry-run leaves no installation state");
  run();
  run();
  assert.equal(fs.readFileSync(active, "utf8"), personal, "customizations must stay in the active Codex rule");

  fs.writeFileSync(source, updated);
  run(true);
  assert.equal(read(base), initial, "preview must not consume the upstream delta");
  assert.equal(fs.readFileSync(active, "utf8"), personal);
  run();
  const merged = personal.replace("unit tests", "unit and integration tests");
  assert.equal(fs.readFileSync(active, "utf8"), merged, "apply independent upstream edits and preserve CRLF");
  run();
  assert.equal(fs.readFileSync(active, "utf8"), merged, "a retry does not duplicate edits");

  fs.writeFileSync(source, updated.replace("Scope: fix bugs.", "Scope: add features."));
  run();
  assert.equal(fs.readFileSync(active, "utf8"), merged, "overlapping edits leave the personal rule intact");
  assert.equal(read(base), updated, "keep the last applied base for a retry");
  assert.equal(read(incoming), read(source), "offer the conflicting distribution outside active rules");
  run();
  assert.equal(fs.readFileSync(active, "utf8"), merged);

  // Apply a later non-conflicting release even if Git was unavailable on the first attempt.
  const later = updated.replace("Run unit and integration tests.", "Run the release checks.");
  fs.writeFileSync(source, later);
  const originalPath = process.env.PATH;
  try {
    process.env.PATH = path.join(tempRoot, "no-git");
    run();
  } finally {
    process.env.PATH = originalPath;
  }
  assert.equal(fs.readFileSync(active, "utf8"), merged, "missing Git preserves the usable rule");
  assert.equal(read(base), updated);
  assert.equal(read(incoming), later);
  run();
  assert.equal(read(active), later.replace("fix bugs.", "fix bugs. Leave unrelated work alone."));
  assert.equal(read(base), later);
  assert.equal(fs.existsSync(incoming), false);

  const stockRoot = path.join(tempRoot, "codex-stock");
  const stock = path.join(stockRoot, "rules", filename);
  fs.mkdirSync(path.dirname(stock), { recursive: true });
  fs.writeFileSync(stock, old.replace(/\n/g, "\r\n"));
  installRules({ sourceRoot: fixture, installRoot: stockRoot, host: "codex", log: () => {} });
  assert.equal(read(stock), read(source), "a known older distribution still upgrades");
}

function checkAntigravityImplementationRuleUpgrades() {
  const fixture = path.join(tempRoot, "ag-rule-source");
  const filename = "02-implementation.md";
  const source = path.join(fixture, "rules", filename);
  const old = [
    "# Implementation",
    "Scope: fix bugs.",
    "",
    "# Checks",
    "Run unit tests.",
    "",
  ].join("\n");
  const hash = crypto.createHash("sha256").update(old).digest("hex");
  fs.mkdirSync(path.join(fixture, "rules/common"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "scripts"));
  fs.writeFileSync(source, old);
  fs.writeFileSync(path.join(fixture, "rules/common/testing.md"), "Run checks.\n");
  fs.writeFileSync(path.join(fixture, "scripts/legacy-common-rule-hashes.json"),
    JSON.stringify({ files: { [filename]: [hash] } }));

  const installRoot = path.join(tempRoot, "ag-rule-install");
  const active = path.join(installRoot, "references/rules", filename);
  const base = path.join(installRoot, ".cew-rule-state/02-implementation.base.md");
  const incoming = path.join(installRoot, ".cew-rule-state/02-implementation.incoming.md");
  const run = () => installRules({ sourceRoot: fixture, installRoot, host: "antigravity", log: () => {} });

  run();
  assert.equal(fs.existsSync(path.join(installRoot, "rules", filename)), false,
    "Antigravity must keep detailed rules out of auto-loaded rules/");
  assert.equal(read(active), old);
  assert.equal(read(path.join(installRoot, "references/rules/common/testing.md")), "Run checks.\n");

  const personal = old.replace("fix bugs.", "fix bugs. Leave unrelated work alone.").replace(/\n/g, "\r\n");
  fs.writeFileSync(active, personal);
  const updated = old.replace("unit tests", "unit and integration tests");
  fs.writeFileSync(source, updated);
  run();
  const merged = personal.replace("unit tests", "unit and integration tests");
  assert.equal(fs.readFileSync(active, "utf8"), merged, "Antigravity merges independent upstream edits");

  fs.writeFileSync(source, updated.replace("Scope: fix bugs.", "Scope: add features."));
  run();
  assert.equal(fs.readFileSync(active, "utf8"), merged, "overlapping edits keep personal rule intact");
  assert.equal(read(base), updated);
  assert.equal(read(incoming), read(source));
}

function checkInstallerCliOptions() {
  const profile = path.join(tempRoot, "invalid-cli-profile");
  for (const [options, message] of [
    [["--unknown-option"], /Unknown option: --unknown-option/],
    [["--claude-only", "--codex-only"], /cannot be used together/],
    [["--codex-only", "--claude-only"], /cannot be used together/],
    [["--claude-only", "--antigravity-only"], /cannot be used together/],
    [["--codex-only", "--antigravity-only"], /cannot be used together/],
    [["--claude-only", "--codex-only", "--help"], /cannot be used together/],
    [["--antigravity-only", "--claude-only", "--help"], /cannot be used together/],
  ]) {
    const result = spawnSync(process.execPath, [
      path.join(sourceRoot, "bin/claude-everything-workflow.js"), "install", ...options,
    ], {
      cwd: sourceRoot, env: { ...process.env, USERPROFILE: profile, HOME: profile },
      encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, "invalid CLI options must fail before installation");
    assert.match(result.stderr, message);
  }
  for (const host of [".claude", ".codex", ".gemini"]) {
    assert.equal(fs.existsSync(path.join(profile, host)), false);
  }
  for (const help of ["--help", "-h"]) {
    const result = spawnSync(process.execPath, [
      path.join(sourceRoot, "bin/claude-everything-workflow.js"), "install", help,
    ], {
      cwd: sourceRoot, env: { ...process.env, USERPROFILE: profile, HOME: profile },
      encoding: "utf8", timeout: 60000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, "install help must succeed without installing");
    assert.match(result.stdout, /Usage:/);
    for (const host of [".claude", ".codex", ".gemini"]) {
      assert.equal(fs.existsSync(path.join(profile, host)), false);
    }
  }
}

function checkBashHelpOptions() {
  const executable = process.env.CEW_TEST_BASH || (process.platform === "win32" ? null : "bash");
  if (!executable) return;
  const profile = path.join(tempRoot, "bash options profile");
  const invalidOptions = [
    ["--help", "--claude-only", "--codex-only"],
    ["--claude-only", "--help", "--codex-only"],
    ["--claude-only", "--codex-only", "--help"],
    ["--help", "--antigravity-only", "--codex-only"],
    ["--claude-only", "--antigravity-only", "--help"],
    ["--help", "--unknown-option"],
    ["--unknown-option", "--help"],
  ];
  for (const options of [...invalidOptions, ["--help"], ["-h"]]) {
    const result = spawnSync(executable, ["scripts/install.sh", ...options], {
      cwd: sourceRoot, env: { ...process.env, HOME: profile },
      encoding: "utf8", timeout: 60000,
    });
    assert.ifError(result.error);
    if (options.length === 1) {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Usage:/);
    } else {
      assert.notEqual(result.status, 0, `Bash must reject invalid options even with help: ${options.join(" ")}`);
      assert.match(result.stderr, /Unknown option|cannot be used together/);
    }
    for (const host of [".claude", ".codex", ".gemini"]) {
      assert.equal(fs.existsSync(path.join(profile, host)), false);
    }
  }
}

function checkInstallerLinkedRoots() {
  for (const [host, flag] of [
    [".claude", "--claude-only"],
    [".codex", "--codex-only"],
    [".gemini", "--antigravity-only"],
  ]) {
    const profile = path.join(tempRoot, "linked-profile" + host);
    const outside = path.join(tempRoot, "linked-outside" + host);
    fs.mkdirSync(profile);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "AGENTS.md"), "Keep external user content\n");
    fs.symlinkSync(outside, path.join(profile, host), process.platform === "win32" ? "junction" : "dir");
    const result = spawnSync(process.execPath, [
      path.join(sourceRoot, "bin/claude-everything-workflow.js"), "install", flag,
    ], {
      cwd: sourceRoot,
      env: {
        ...process.env, USERPROFILE: profile, HOME: profile,
        ...(process.platform === "win32" ? {
          PSModulePath: path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/Modules"),
        } : {}),
      },
      encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, "linked install roots must be rejected");
    assert.match(result.stderr, /symlink/i);
    assert.deepEqual(fs.readdirSync(outside), ["AGENTS.md"], "reject links before any external writes");
    assert.equal(read(path.join(outside, "AGENTS.md")), "Keep external user content\n");
  }
}

function checkInstallerMergeFailure() {
  if (process.platform !== "win32") return;
  const profile = path.join(tempRoot, "merge failure profile");
  const settingsPath = path.join(profile, ".claude/settings.json");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const previous = JSON.stringify({ env: { KEEP: "yes" }, hooks: { SessionStart: null } });
  fs.writeFileSync(settingsPath, previous);
  const result = spawnSync(process.execPath, [
    path.join(sourceRoot, "bin/claude-everything-workflow.js"), "install", "--claude-only",
  ], {
    cwd: sourceRoot,
    env: {
      ...process.env, USERPROFILE: profile, HOME: profile,
      PSModulePath: path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/Modules"),
    },
    encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, "a failed settings merge must fail the installation");
  assert.match(result.stderr, /Claude settings merge failed/);
  assert.doesNotMatch(result.stdout, /Install complete/);
  assert.equal(fs.readFileSync(settingsPath, "utf8"), previous);
}

function checkInstallerEntrypoint() {
  const profile = path.join(tempRoot, "installer-profile");
  const windows = process.platform === "win32";
  const executable = windows ? "powershell.exe" : (process.env.CEW_TEST_BASH || "bash");
  const args = windows
    ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(sourceRoot, "scripts/install.ps1")]
    : [path.join(sourceRoot, "scripts/install.sh")];
  // The child gets a disposable profile; never update this process's home or the user's installation.
  const env = { ...process.env, USERPROFILE: profile, HOME: profile };
  const invalid = spawnSync(executable, [...args, windows ? "-UnknownOption" : "--unknown-option"], {
    cwd: sourceRoot, env, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(invalid.error);
  assert.notEqual(invalid.status, 0, "direct installer must reject unknown options before writing");
  assert.equal(fs.existsSync(path.join(profile, ".claude")), false);
  assert.equal(fs.existsSync(path.join(profile, ".codex")), false);
  assert.equal(fs.existsSync(path.join(profile, ".gemini")), false);
  for (const only of [
    windows ? ["-ClaudeOnly", "-CodexOnly"] : ["--claude-only", "--codex-only"],
    windows ? ["-CodexOnly", "-ClaudeOnly"] : ["--codex-only", "--claude-only"],
    windows ? ["-ClaudeOnly", "-AntigravityOnly"] : ["--claude-only", "--antigravity-only"],
  ]) {
    const conflict = spawnSync(executable, [...args, ...only], {
      cwd: sourceRoot, env, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    });
    assert.ifError(conflict.error);
    assert.notEqual(conflict.status, 0, "direct installer must reject conflicting host options");
    assert.match(conflict.stderr, /cannot be used together/);
    for (const host of [".claude", ".codex", ".gemini"]) {
      assert.equal(fs.existsSync(path.join(profile, host)), false);
    }
  }
  const run = (extra = []) => {
    const result = spawnSync(executable, [...args, ...extra], {
      cwd: sourceRoot, env, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result;
  };
  run([windows ? "-DryRun" : "--dry-run"]);
  assert.equal(fs.existsSync(path.join(profile, ".claude")), false);
  assert.equal(fs.existsSync(path.join(profile, ".codex")), false);
  assert.equal(fs.existsSync(path.join(profile, ".gemini")), false);
  // Seed an older installation to exercise retirement and policy replacement through the real CLI.
  for (const host of [".claude", ".codex"]) {
    const skills = path.join(profile, host, "skills");
    for (const retired of ["research", "wayfinder", "find-skills", "project-context", "iterative-retrieval", "using-git-worktrees", "verification-before-completion"]) {
      fs.mkdirSync(path.join(skills, retired), { recursive: true });
      const known = {
        research: ["SKILL.md"],
        "iterative-retrieval": ["SKILL.md"],
        "using-git-worktrees": ["SKILL.md"],
        "verification-before-completion": ["SKILL.md"],
        wayfinder: ["SKILL.md", "agents/openai.yaml"],
        "find-skills": ["SKILL.md", "agents/openai.yaml", "references/skills-cli.md"],
        "project-context": ["SKILL.md", "agents/openai.yaml", "references/project-context-template.md"],
      };
      for (const file of known[retired]) {
        const target = path.join(skills, retired, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, "Old distributed content\n");
      }
      fs.writeFileSync(path.join(skills, retired, "personal-notes.md"), "Keep my notes\n");
    }
    fs.mkdirSync(path.join(skills, "handoff/agents"), { recursive: true });
    fs.writeFileSync(path.join(skills, "handoff/agents/openai.yaml"),
      "policy:\n  allow_implicit_invocation: false\n");
  }
  const settingsPath = path.join(profile, ".claude/settings.json");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const userHookGroup = {
    matcher: "Edit|Write|MultiEdit",
    hooks: [
      { type: "command", command: 'node "$HOME/.claude/my-hooks/observe.js"', timeout: 7 },
      { type: "command", command: 'node "$HOME/.claude/hooks/runtime/run-with-flags.js" post:edit:console-log "$HOME/.claude/hooks/my-team-check.js" standard,strict' },
      { type: "prompt", prompt: "Keep this user hook" },
    ],
  };
  const unrelatedHook = {
    matcher: "Bash",
    hooks: [{ type: "command", command: 'node "./hooks/session-start.js"' }],
  };
  const retiredSession = {
    type: "command",
    command: 'node "$HOME/.claude/hooks/runtime/run-with-flags.js" session:start "$HOME/.claude/hooks/session-start.js" minimal,standard,strict',
  };
  const retiredConsole = {
    type: "command",
    command: 'node scripts/hooks/run-with-flags.js post:write:console-log hooks/check-console-log.js standard,strict',
  };
  fs.writeFileSync(settingsPath, JSON.stringify({
    hooks: {
      PostToolUse: [{ ...userHookGroup, hooks: [...userHookGroup.hooks, retiredConsole] }],
      SessionStart: [{ ...unrelatedHook, hooks: [...unrelatedHook.hooks, retiredSession] }],
    },
  }));
  fs.writeFileSync(path.join(profile, ".claude/AGENTS.md"), "My original instructions\n");
  run();
  // Give the first snapshot a distinct, earlier timestamp even on fast machines.
  const backups = path.join(profile, ".claude", BACKUP_ROOT_NAME);
  const [firstSnapshot] = fs.readdirSync(backups);
  const earlier = "20000101000000";
  fs.renameSync(path.join(backups, firstSnapshot), path.join(backups, earlier));
  const installedSettings = JSON.parse(read(settingsPath).replace(/^\uFEFF/, ""));
  assert.deepEqual(installedSettings.hooks.PostToolUse[0], userHookGroup);
  assert.deepEqual(installedSettings.hooks.SessionStart, [unrelatedHook]);
  assert.equal(installedSettings.hooks.PostToolUse.flatMap(({ hooks }) => hooks)
    .filter(({ command }) => command?.includes("hooks/check-console-log.js")).length, 1);
  const codexRule = path.join(profile, ".codex/rules/02-implementation.md");
  const customizedRule = read(codexRule) + "\nKeep unrelated work separate.\n";
  fs.writeFileSync(codexRule, customizedRule);
  assert.equal(fs.existsSync(path.join(profile, ".gemini")), false,
    "default install must not create ~/.gemini when it does not already exist");

  // Default install must skip symlinked ~/.gemini without failing Claude/Codex updates.
  const linkedGeminiOutside = path.join(tempRoot, "installer-linked-gemini");
  fs.mkdirSync(linkedGeminiOutside);
  fs.writeFileSync(path.join(linkedGeminiOutside, "sentinel.txt"), "keep\n");
  fs.symlinkSync(
    linkedGeminiOutside,
    path.join(profile, ".gemini"),
    windows ? "junction" : "dir",
  );
  const skippedLinked = run();
  assert.match(skippedLinked.stdout, /Skipping Antigravity plugin sync/);
  assert.deepEqual(fs.readdirSync(linkedGeminiOutside), ["sentinel.txt"]);
  assert.equal(read(codexRule), customizedRule, "the host installer must preserve the active Codex rule");

  // Once a regular ~/.gemini directory exists, default install syncs Antigravity automatically.
  fs.unlinkSync(path.join(profile, ".gemini"));
  fs.mkdirSync(path.join(profile, ".gemini"));
  run();
  assert.equal(read(codexRule), customizedRule, "the host installer must preserve the active Codex rule");
  assert.equal(read(path.join(backups, earlier, "AGENTS.md")), "My original instructions\n");
  assert.deepEqual(JSON.parse(read(settingsPath).replace(/^\uFEFF/, "")), installedSettings,
    "reinstallation must preserve user hooks and add each managed hook only once");
  assert.equal(read(path.join(profile, ".claude/references/rules/common/testing.md")),
    read(path.join(sourceRoot, "rules/common/testing.md")));
  assert.equal(fs.existsSync(path.join(profile, ".claude/rules/common/testing.md")), false);
  assert.equal(read(path.join(profile, ".codex/rules/common/testing.md")),
    read(path.join(sourceRoot, "rules/common/testing.md")));
  const claudeBootstrap = read(path.join(profile, ".claude/CLAUDE.md"));
  assert.match(claudeBootstrap, /^@AGENTS\.md$/m);
  assert.ok(claudeBootstrap.includes("~/.claude/references/rules/"),
    "Claude's installed entry must locate on-demand rules outside the startup directory");
  for (const host of [".claude", ".codex"]) {
    assert.equal(read(path.join(profile, host, "references/git-worktrees.md")),
      read(path.join(sourceRoot, "references/git-worktrees.md")));
    for (const retired of ["research", "wayfinder", "find-skills", "project-context", "iterative-retrieval", "using-git-worktrees", "verification-before-completion"]) {
      assert.equal(fs.existsSync(path.join(profile, host, "skills", retired, "SKILL.md")), false);
      const remaining = fs.readdirSync(path.join(profile, host, "skills", retired));
      assert.deepEqual(remaining, ["personal-notes.md"]);
      assert.equal(read(path.join(profile, host, "skills", retired, "personal-notes.md")), "Keep my notes\n");
    }
    assert.equal(fs.existsSync(path.join(profile, host, "skills/wayfinder/agents")), false);
    assert.equal(fs.existsSync(path.join(profile, host, "scripts/install-rules.js")), false);
    assert.equal(fs.existsSync(path.join(profile, host, "scripts/install-antigravity.js")), false);
    assert.equal(fs.existsSync(path.join(profile, host, "scripts/eval-scenarios.js")), false,
      "安装不应保留仅供包内评测的场景脚本");
    assert.equal(fs.existsSync(path.join(profile, host, "scripts/verify/scenario-checks.test.js")), false,
      "安装不应保留仅供包内验证的场景测试");
    assert.equal(fs.existsSync(path.join(profile, host, "scripts/verify/plugin-distribution.test.js")), false,
      "安装不应保留仅供包内验证的插件分发测试");
    assert.equal(fs.existsSync(path.join(profile, host, "scripts/verify/learning.test.js")), false,
      "安装不应保留仅供包内验证的持续学习测试");
    assert.match(read(path.join(profile, host, "skills/handoff/agents/openai.yaml")),
      /allow_implicit_invocation: true/);
  }

  const agRoot = path.join(profile, ".gemini/config/plugins/claude-everything-workflow");
  const pkg = JSON.parse(read(path.join(sourceRoot, "package.json")));
  const manifest = JSON.parse(read(path.join(agRoot, "plugin.json")));
  assert.equal(manifest.name, pkg.name);
  assert.equal(manifest.version, pkg.version);
  assert.deepEqual(fs.readdirSync(path.join(agRoot, "rules")), ["AGENTS.md"]);
  assert.match(read(path.join(agRoot, "rules/AGENTS.md")), /plugins\/claude-everything-workflow\/references\/rules\//);
  assert.equal(read(path.join(agRoot, "references/rules/common/testing.md")),
    read(path.join(sourceRoot, "rules/common/testing.md")));
  assert.equal(fs.existsSync(path.join(agRoot, "skills/README.md")), false);
  const agSkills = fs.readdirSync(path.join(agRoot, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  assert.equal(agSkills.length, 22);
  for (const dir of agSkills) {
    const skillMd = read(path.join(agRoot, "skills", dir.name, "SKILL.md"));
    assert.match(skillMd, new RegExp(`^---\\nname: ${dir.name}\\ndescription: .+`, "m"));
  }
  assert.doesNotMatch(read(path.join(agRoot, "skills/pr/SKILL.md")), /\$ARGUMENTS/);
  assert.doesNotMatch(read(path.join(agRoot, "skills/learn/SKILL.md")), /\$ARGUMENTS/);
  const agAgents = fs.readdirSync(path.join(agRoot, "agents")).sort();
  assert.equal(agAgents.length, 5);
  for (const agentFile of agAgents) {
    const body = read(path.join(agRoot, "agents", agentFile));
    assert.match(body, /^subagent: true$/m);
    assert.match(body, /^mainAgent: false$/m);
    assert.match(body, /^tools: \[/m);
    assert.doesNotMatch(body, /^model:/m);
  }
  assert.match(read(path.join(agRoot, "agents/e2e-runner.md")),
    /~\/\.gemini\/config\/plugins\/claude-everything-workflow\/skills\/feature-acceptance\/references\/e2e-testing\.md/);
  assert.match(read(path.join(agRoot, "agents/security-reviewer.md")),
    /~\/\.gemini\/config\/plugins\/claude-everything-workflow\/references\/agents\/security-reviewer\.md/);
  assert.equal(fs.existsSync(path.join(agRoot, "scripts/learning/projects.js")), true);
  assert.equal(fs.existsSync(path.join(agRoot, "harness/manifest.json")), true);
  assert.equal(fs.existsSync(path.join(agRoot, "scripts/install-antigravity.js")), false);
}

function checkAntigravityOnlyInstaller() {
  const profile = path.join(tempRoot, "antigravity-only-profile");
  const agRoot = path.join(profile, ".gemini/config/plugins/claude-everything-workflow");
  const legacyAgents = path.join(profile, ".gemini/AGENTS.md");
  fs.mkdirSync(path.join(agRoot, "skills/research"), { recursive: true });
  fs.writeFileSync(path.join(agRoot, "skills/research/SKILL.md"), "Old distributed content\n");
  fs.writeFileSync(path.join(agRoot, "skills/research/personal-notes.md"), "Keep my notes\n");
  fs.writeFileSync(legacyAgents, "Keep legacy user file\n");

  const runCli = (extra = []) => {
    const result = spawnSync(process.execPath, [
      path.join(sourceRoot, "bin/claude-everything-workflow.js"), "install", "--antigravity-only", ...extra,
    ], {
      cwd: sourceRoot,
      env: { ...process.env, USERPROFILE: profile, HOME: profile },
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result;
  };

  runCli(["--dry-run"]);
  assert.equal(fs.existsSync(path.join(agRoot, "plugin.json")), false);

  const first = runCli();
  assert.equal(fs.existsSync(path.join(profile, ".claude")), false);
  assert.equal(fs.existsSync(path.join(profile, ".codex")), false);
  assert.equal(read(legacyAgents), "Keep legacy user file\n", "legacy ~/.gemini/AGENTS.md must not be removed");
  assert.match(first.stdout, /\.gemini[\\/]AGENTS\.md/);
  assert.equal(fs.existsSync(path.join(agRoot, "skills/research/SKILL.md")), false);
  assert.equal(read(path.join(agRoot, "skills/research/personal-notes.md")), "Keep my notes\n");

  const agImpl = path.join(agRoot, "references/rules/02-implementation.md");
  const customized = read(agImpl) + "\nKeep Antigravity personal rule.\n";
  fs.writeFileSync(agImpl, customized);
  fs.writeFileSync(path.join(agRoot, "plugin.json"), '{"name":"old"}\n');
  runCli();
  assert.equal(read(agImpl), customized, "reinstall must preserve Antigravity personal 02-implementation.md");
  const backupsDir = path.join(agRoot, BACKUP_ROOT_NAME);
  const snapshots = fs.readdirSync(backupsDir);
  assert.equal(snapshots.length, 1);
  assert.equal(read(path.join(backupsDir, snapshots[0], "plugin.json")), '{"name":"old"}\n');
}

function checkAntigravityEdgeCases() {
  // 1. Pre-write rule target validation must refuse symlinked references/rules before writing any file.
  const precheckHome = path.join(tempRoot, "ag-precheck-home");
  const outsideRules = path.join(tempRoot, "ag-outside-rules");
  const precheckPlugin = path.join(precheckHome, ".gemini/config/plugins/claude-everything-workflow");
  fs.mkdirSync(outsideRules, { recursive: true });
  fs.mkdirSync(path.join(precheckPlugin, "references"), { recursive: true });
  fs.symlinkSync(
    outsideRules,
    path.join(precheckPlugin, "references/rules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(
    () => installAntigravity({ sourceRoot, homeDir: precheckHome, log: () => {} }),
    /symlink/i,
  );
  assert.equal(fs.existsSync(path.join(precheckPlugin, "plugin.json")), false,
    "symlinked references/rules must fail before any partial plugin write");
  assert.deepEqual(fs.readdirSync(outsideRules), []);

  // 2. Read-only source files (0o444) install with owner-writable permissions so upgrades succeed.
  if (process.platform !== "win32") {
    const roHome = path.join(tempRoot, "ag-ro-home");
    const roSource = path.join(tempRoot, "ag-ro-source");
    fs.cpSync(sourceRoot, roSource, {
      recursive: true,
      filter: (src) => !src.includes(`${path.sep}node_modules`) && !src.includes(`${path.sep}.git`),
    });
    const roRef = path.join(roSource, "references/git-worktrees.md");
    fs.chmodSync(roRef, 0o444);
    try {
      const installedRoot = installAntigravity({ sourceRoot: roSource, homeDir: roHome, log: () => {} });
      const installedRef = path.join(installedRoot, "references/git-worktrees.md");
      assert.ok((fs.statSync(installedRef).mode & 0o200) !== 0, "installed file must keep owner write bit");
      fs.chmodSync(roRef, 0o644);
      fs.writeFileSync(roRef, "# Updated worktrees\n");
      installAntigravity({ sourceRoot: roSource, homeDir: roHome, log: () => {} });
      assert.equal(read(installedRef), "# Updated worktrees\n");
    } finally {
      fs.chmodSync(roRef, 0o644);
    }
  }

  // 3. Symlinked $HOME is allowed when .gemini chain itself is clean.
  const realHome = path.join(tempRoot, "ag-real-home");
  const linkedHome = path.join(tempRoot, "ag-linked-home");
  fs.mkdirSync(realHome);
  fs.symlinkSync(realHome, linkedHome, process.platform === "win32" ? "junction" : "dir");
  const linkedPlugin = installAntigravity({ sourceRoot, homeDir: linkedHome, log: () => {} });
  assert.equal(fs.existsSync(path.join(linkedPlugin, "plugin.json")), true);

  // 4. Zero-indent YAML lists parse cleanly; invalid/unmapped explicit tools throw instead of fail-open.
  const parsedList = parseFrontmatter("---\nname: demo\ntools:\n- Read\n- Grep\n---\n\nBody\n");
  assert.deepEqual(parsedList.data.tools, ["Read", "Grep"]);
  assert.deepEqual(mapTools(["Read", "Grep"], "demo.md"), ["read_file"]);
  assert.throws(() => mapTools(["UnknownTool"], "demo.md"), /no supported Antigravity tools/);
  assert.throws(() => mapTools([], "demo.md"), /no supported Antigravity tools/);
  assert.throws(() => mapTools("Read", "demo.md"), /invalid tools/);

  // 5. Reject "." as --backup-id in both CLI entrypoints.
  for (const script of ["scripts/install-rules.js", "scripts/install-antigravity.js"]) {
    const args = script.endsWith("install-rules.js")
      ? [path.join(sourceRoot, script), "codex", path.join(tempRoot, "unused"), "--backup-id", "."]
      : [path.join(sourceRoot, script), path.join(tempRoot, "unused"), "--backup-id", "."];
    const res = spawnSync(process.execPath, args, { cwd: sourceRoot, encoding: "utf8" });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /Invalid --backup-id/);
  }

  // 6. Bash --antigravity-only works without rsync on PATH.
  if (process.platform !== "win32") {
    const noRsyncProfile = path.join(tempRoot, "ag-no-rsync-profile");
    const noRsyncBin = path.join(tempRoot, "ag-no-rsync-bin");
    fs.mkdirSync(noRsyncBin, { recursive: true });
    fs.symlinkSync(process.execPath, path.join(noRsyncBin, "node"));
    for (const tool of ["dirname", "date"]) {
      const located = spawnSync("which", [tool], { encoding: "utf8" }).stdout.trim();
      if (located) fs.symlinkSync(located, path.join(noRsyncBin, tool));
    }
    const executable = process.env.CEW_TEST_BASH || "bash";
    const res = spawnSync(executable, ["scripts/install.sh", "--antigravity-only"], {
      cwd: sourceRoot,
      env: { ...process.env, HOME: noRsyncProfile, PATH: `${noRsyncBin}:/bin` },
      encoding: "utf8",
      timeout: 60000,
    });
    assert.ifError(res.error);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.equal(
      fs.existsSync(path.join(noRsyncProfile, ".gemini/config/plugins/claude-everything-workflow/plugin.json")),
      true,
    );
  }
}

try {
  install("fresh");
  const fresh = path.join(tempRoot, "fresh");
  const common = fs.readdirSync(path.join(sourceRoot, "rules/common"));
  assert.equal(common.length, 8);
  const resident = ["01-base.md", "02-implementation.md", "05-git-workflow.md"];
  assert.deepEqual(fs.readdirSync(path.join(fresh, "rules")).sort(), resident);
  install("codex", "codex");
  for (const file of [...resident, ...common.map((name) => `common/${name}`)]) {
    const source = read(path.join(sourceRoot, "rules", file));
    const claudeDir = resident.includes(file) ? "rules" : "references/rules";
    assert.equal(read(path.join(fresh, claudeDir, file)), source);
    assert.equal(read(path.join(tempRoot, "codex/rules", file)), source);
  }
  install("preview", "claude-code", true);
  assert.equal(fs.existsSync(path.join(tempRoot, "preview")), false);

  const upgrade = path.join(tempRoot, "upgrade");
  fs.mkdirSync(path.join(upgrade, "rules/common"), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, "rules/common/testing.md"),
    path.join(upgrade, "rules/common/testing.md"));
  fs.writeFileSync(path.join(upgrade, "rules/common/hooks.md"), "Personal hook policy\n");
  fs.writeFileSync(path.join(upgrade, "rules/common/personal.md"), "Keep my rules\n");
  fs.writeFileSync(path.join(upgrade, "rules/08-specialty-rules-index.md"), "Personal index\n");
  install("upgrade", "claude-code", true);
  assert.equal(fs.existsSync(path.join(upgrade, "references")), false);
  install("upgrade");
  assert.equal(fs.existsSync(path.join(upgrade, "rules/common/testing.md")), false);
  assert.equal(read(path.join(upgrade, "rules/common/hooks.md")), "Personal hook policy\n");
  assert.equal(read(path.join(upgrade, "rules/common/personal.md")), "Keep my rules\n");
  assert.equal(read(path.join(upgrade, "rules/08-specialty-rules-index.md")), "Personal index\n");
  assert.ok(messages.some((message) => /保留.*hooks\.md/.test(message)));
  install("upgrade");
  assert.equal(read(path.join(upgrade, "rules/common/hooks.md")), "Personal hook policy\n");

  const outside = path.join(tempRoot, "outside");
  fs.mkdirSync(outside);
  const linked = path.join(tempRoot, "linked");
  fs.mkdirSync(linked);
  fs.symlinkSync(outside, path.join(linked, "references"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => install("linked"), /symlink/i);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.throws(() => install("invalid", "unknown"), /host/i);
  checkLegacyMigration();
  checkPromotedImplementationRule();
  checkCodexImplementationRuleUpgrades();
  checkAntigravityImplementationRuleUpgrades();
  checkInstallerCliOptions();
  checkBashHelpOptions();
  checkInstallerLinkedRoots();
  checkInstallerMergeFailure();
  checkInstallerEntrypoint();
  checkAntigravityOnlyInstaller();
  checkAntigravityEdgeCases();
  console.log("Rule installation tests passed (migration, backups, custom rules, symlink safety, both hosts, installer dry-run and execution).");
} finally {
  // Only remove the exact private directory returned by mkdtemp; never a caller-supplied path.
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
