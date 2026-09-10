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

function checkInstallerEntrypoint() {
  const profile = path.join(tempRoot, "installer-profile");
  const windows = process.platform === "win32";
  const executable = windows ? "powershell.exe" : (process.env.CEW_TEST_BASH || "bash");
  const args = windows
    ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(sourceRoot, "scripts/install.ps1")]
    : [path.join(sourceRoot, "scripts/install.sh")];
  // The child gets a disposable profile; never update this process's home or the user's installation.
  const env = { ...process.env, USERPROFILE: profile, HOME: profile };
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
  run();
  assert.equal(read(path.join(profile, ".claude/references/rules/common/testing.md")),
    read(path.join(sourceRoot, "rules/common/testing.md")));
  assert.equal(fs.existsSync(path.join(profile, ".claude/rules/common/testing.md")), false);
  assert.equal(read(path.join(profile, ".codex/rules/common/testing.md")),
    read(path.join(sourceRoot, "rules/common/testing.md")));
  assert.match(read(path.join(profile, ".claude/CLAUDE.md")), /^@AGENTS\.md$/m);
  for (const host of [".claude", ".codex"]) {
    assert.equal(fs.existsSync(path.join(profile, host, "scripts/install-rules.js")), false);
    assert.match(read(path.join(profile, host, "skills/handoff/agents/openai.yaml")),
      /allow_implicit_invocation: false/);
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
  checkInstallerEntrypoint();
  console.log("Rule installation tests passed (migration, backups, custom rules, symlink safety, both hosts, installer dry-run and execution).");
} finally {
  // Only remove the exact private directory returned by mkdtemp; never a caller-supplied path.
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
