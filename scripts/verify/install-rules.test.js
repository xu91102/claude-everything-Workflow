"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { installRules } = require("../install-rules");

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
  fs.writeFileSync(path.join(fixture, "scripts/legacy-common-rule-hashes.json"),
    JSON.stringify({ files: { "common/testing.md": [hash] } }));
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

  const cold = path.join(target, "references/rules/common/testing.md");
  fs.writeFileSync(cold, previous);
  installRules(options);
  assert.equal(read(cold), "Current distribution\n");
  assert.equal(read(cold + ".bak." + hash), previous);
}

function checkInstallerCliOptions() {
  const profile = path.join(tempRoot, "invalid-cli-profile");
  for (const [options, message] of [
    [["--unknown-option"], /Unknown option: --unknown-option/],
    [["--claude-only", "--codex-only"], /cannot be used together/],
    [["--codex-only", "--claude-only"], /cannot be used together/],
    [["--claude-only", "--codex-only", "--help"], /cannot be used together/],
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
  for (const host of [".claude", ".codex"]) {
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
    for (const host of [".claude", ".codex"]) {
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
    for (const host of [".claude", ".codex"]) {
      assert.equal(fs.existsSync(path.join(profile, host)), false);
    }
  }
}

function checkInstallerLinkedRoots() {
  for (const host of [".claude", ".codex"]) {
    const profile = path.join(tempRoot, "linked-profile" + host);
    const outside = path.join(tempRoot, "linked-outside" + host);
    fs.mkdirSync(profile);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "AGENTS.md"), "Keep external user content\n");
    fs.symlinkSync(outside, path.join(profile, host), process.platform === "win32" ? "junction" : "dir");
    const result = spawnSync(process.execPath, [
      path.join(sourceRoot, "bin/claude-everything-workflow.js"), "install",
      host === ".claude" ? "--claude-only" : "--codex-only",
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
  for (const only of [
    windows ? ["-ClaudeOnly", "-CodexOnly"] : ["--claude-only", "--codex-only"],
    windows ? ["-CodexOnly", "-ClaudeOnly"] : ["--codex-only", "--claude-only"],
  ]) {
    const conflict = spawnSync(executable, [...args, ...only], {
      cwd: sourceRoot, env, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    });
    assert.ifError(conflict.error);
    assert.notEqual(conflict.status, 0, "direct installer must reject conflicting host options");
    assert.match(conflict.stderr, /cannot be used together/);
    for (const host of [".claude", ".codex"]) {
      assert.equal(fs.existsSync(path.join(profile, host)), false);
    }
  }
  const run = (extra = []) => {
    const result = spawnSync(executable, [...args, ...extra], {
      cwd: sourceRoot, env, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  run([windows ? "-DryRun" : "--dry-run"]);
  assert.equal(fs.existsSync(path.join(profile, ".claude")), false);
  assert.equal(fs.existsSync(path.join(profile, ".codex")), false);
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
  run();
  assert.equal(read(path.join(profile, ".claude/references/rules/common/testing.md")),
    read(path.join(sourceRoot, "rules/common/testing.md")));
  assert.equal(fs.existsSync(path.join(profile, ".claude/rules/common/testing.md")), false);
  assert.equal(read(path.join(profile, ".codex/rules/common/testing.md")),
    read(path.join(sourceRoot, "rules/common/testing.md")));
  assert.match(read(path.join(profile, ".claude/CLAUDE.md")), /^@AGENTS\.md$/m);
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
    assert.equal(fs.existsSync(path.join(profile, host, "scripts/verify/continuation-checks.test.js")), false,
      "安装不应保留仅供包内验证的续接测试");
    assert.equal(fs.existsSync(path.join(profile, host, "scripts/verify/plugin-distribution.test.js")), false,
      "安装不应保留仅供包内验证的插件分发测试");
    assert.match(read(path.join(profile, host, "skills/handoff/agents/openai.yaml")),
      /allow_implicit_invocation: true/);
  }
}

try {
  install("fresh");
  const fresh = path.join(tempRoot, "fresh");
  const common = fs.readdirSync(path.join(sourceRoot, "rules/common"));
  assert.equal(common.length, 8);
  for (const file of common) {
    assert.equal(read(path.join(fresh, "references/rules/common", file)),
      read(path.join(sourceRoot, "rules/common", file)));
    assert.equal(fs.existsSync(path.join(fresh, "rules/common", file)), false);
  }
  assert.equal(read(path.join(fresh, "rules/07-forbidden.md")),
    read(path.join(sourceRoot, "rules/07-forbidden.md")));

  install("codex", "codex");
  assert.equal(read(path.join(tempRoot, "codex/rules/common/testing.md")),
    read(path.join(sourceRoot, "rules/common/testing.md")));
  install("preview", "claude-code", true);
  assert.equal(fs.existsSync(path.join(tempRoot, "preview")), false);

  const upgrade = path.join(tempRoot, "upgrade");
  fs.mkdirSync(path.join(upgrade, "rules/common"), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, "rules/common/testing.md"),
    path.join(upgrade, "rules/common/testing.md"));
  fs.writeFileSync(path.join(upgrade, "rules/common/hooks.md"), "Personal hook policy\n");
  fs.writeFileSync(path.join(upgrade, "rules/common/personal.md"), "Keep my rules\n");
  install("upgrade");
  assert.equal(fs.existsSync(path.join(upgrade, "rules/common/testing.md")), false);
  assert.equal(read(path.join(upgrade, "rules/common/hooks.md")), "Personal hook policy\n");
  assert.equal(read(path.join(upgrade, "rules/common/personal.md")), "Keep my rules\n");
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
  checkInstallerCliOptions();
  checkBashHelpOptions();
  checkInstallerLinkedRoots();
  checkInstallerMergeFailure();
  checkInstallerEntrypoint();
  console.log("Rule installation tests passed (migration, backups, custom rules, symlink safety, both hosts, installer dry-run and execution).");
} finally {
  // Only remove the exact private directory returned by mkdtemp; never a caller-supplied path.
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
