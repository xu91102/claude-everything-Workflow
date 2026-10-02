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

function checkRetiredRules() {
  const fixture = path.join(tempRoot, "retired-source");
  fs.mkdirSync(path.join(fixture, "rules/common"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "scripts"));
  const original = "Old managed rule\n";
  const hash = crypto.createHash("sha256").update(original).digest("hex");
  fs.writeFileSync(path.join(fixture, "scripts/legacy-common-rule-hashes.json"),
    JSON.stringify({ files: { "02-code-size.md": [hash], "common/implementation.md": [hash] } }));
  for (const host of ["claude-code", "codex"]) {
    const target = path.join(tempRoot, `retired-${host}`);
    fs.mkdirSync(path.join(target, "rules/common"), { recursive: true });
    fs.writeFileSync(path.join(target, "rules/02-code-size.md"), original);
    fs.writeFileSync(path.join(target, "rules/common/implementation.md"), "Personal edits\n");
    fs.writeFileSync(path.join(target, "rules/personal.md"), "Unknown rule\n");
    if (host === "claude-code") {
      fs.mkdirSync(path.join(target, "references/rules/common"), { recursive: true });
      fs.writeFileSync(path.join(target, "references/rules/common/implementation.md"), original);
    }
    const options = { sourceRoot: fixture, installRoot: target, host, log: () => {} };
    installRules({ ...options, dryRun: true });
    assert.equal(read(path.join(target, "rules/02-code-size.md")), original);
    installRules(options);
    assert.equal(fs.existsSync(path.join(target, "rules/02-code-size.md")), false,
      `${host} must retire a known obsolete root rule`);
    assert.equal(read(path.join(target, "rules/common/implementation.md")), "Personal edits\n");
    assert.equal(read(path.join(target, "rules/personal.md")), "Unknown rule\n");
    if (host === "claude-code") {
      assert.equal(fs.existsSync(path.join(target, "references/rules/common/implementation.md")), false);
    }
    installRules(options);
  }
  const linked = path.join(tempRoot, "retired-link");
  const outside = path.join(tempRoot, "retired-outside");
  fs.mkdirSync(path.join(linked, "rules"), { recursive: true });
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(linked, "rules/common"), process.platform === "win32" ? "junction" : "dir");
  fs.writeFileSync(path.join(linked, "rules/02-code-size.md"), original);
  assert.throws(() => installRules({ sourceRoot: fixture, installRoot: linked, host: "codex" }), /symlink/i);
  assert.equal(read(path.join(linked, "rules/02-code-size.md")), original,
    "validate retired paths before deleting any rule");
}

function checkProtectedRules() {
  const fixture = path.join(tempRoot, "protected-source");
  fs.mkdirSync(path.join(fixture, "rules/common"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "scripts"));
  const policy = 'prefix_rule(pattern=["git"], decision="allow")\n';
  const hash = crypto.createHash("sha256").update(policy).digest("hex");
  fs.writeFileSync(path.join(fixture, "scripts/legacy-common-rule-hashes.json"),
    JSON.stringify({ files: { "agents.md": [hash], "default.rules": [hash] } }));
  fs.writeFileSync(path.join(fixture, "rules/current.md"), "Distribution\n");
  fs.writeFileSync(path.join(fixture, "rules/customized.md"), "Distribution\n");
  fs.writeFileSync(path.join(fixture, "rules/policy.md"), policy);
  for (const host of ["claude-code", "codex"]) {
    const target = path.join(tempRoot, `protected-${host}`);
    fs.mkdirSync(path.join(target, "rules"), { recursive: true });
    fs.writeFileSync(path.join(target, "rules/customized.md"), "Personal rules\n");
    for (const file of ["agents.md", "default.rules", "current.md"]) {
      fs.writeFileSync(path.join(target, "rules", file), policy);
    }
    installRules({ sourceRoot: fixture, installRoot: target, host, log: () => {} });
    for (const file of ["agents.md", "default.rules", "current.md"]) {
      assert.equal(read(path.join(target, "rules", file)), policy, `${host} must exclude ${file}`);
    }
    assert.equal(fs.existsSync(path.join(target, "rules/policy.md")), false);
    assert.equal(read(path.join(target, "rules/customized.md")), "Personal rules\n");
  }
}

function checkManagedRuleUpdates() {
  const fixture = path.join(tempRoot, "update-source");
  fs.mkdirSync(path.join(fixture, "rules/common"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "scripts"));
  const previous = "Previous distribution\n";
  const hash = crypto.createHash("sha256").update(previous).digest("hex");
  const prose = "不要在 Markdown 规则里写 `prefix_rule(...)`，执行策略放在 default.rules。\n";
  fs.writeFileSync(path.join(fixture, "scripts/legacy-common-rule-hashes.json"),
    JSON.stringify({ files: { "01-base.md": [hash], "05-git-workflow.md": [hash] } }));
  fs.writeFileSync(path.join(fixture, "rules/01-base.md"), "Current distribution\n");
  fs.writeFileSync(path.join(fixture, "rules/05-git-workflow.md"), "Current distribution\n");
  fs.writeFileSync(path.join(fixture, "rules/07-forbidden.md"), prose);
  const target = path.join(tempRoot, "update-target");
  fs.mkdirSync(path.join(target, "rules"), { recursive: true });
  fs.writeFileSync(path.join(target, "rules/01-base.md"), previous);
  fs.writeFileSync(path.join(target, "rules/05-git-workflow.md"), "Personal git rules\n");
  fs.writeFileSync(path.join(target, "rules/07-forbidden.md"), previous);
  const logs = [];
  installRules({ sourceRoot: fixture, installRoot: target, host: "codex", log: (message) => logs.push(message) });
  assert.equal(read(path.join(target, "rules/01-base.md")), "Current distribution\n",
    "a known older distribution must be upgraded");
  assert.equal(read(path.join(target, "rules/01-base.md.bak." + hash)), previous);
  assert.equal(read(path.join(target, "rules/05-git-workflow.md")), "Personal git rules\n",
    "an unknown installed rule is a personal edit and must not be overwritten");
  assert.deepEqual(fs.readdirSync(path.join(target, "rules")).filter((file) => file.startsWith("05-git-workflow.md.bak.")), []);
  assert.ok(logs.some((message) => /保留个人修改.*05-git-workflow\.md/.test(message)));
  assert.equal(read(path.join(target, "rules/07-forbidden.md")), previous,
    "07-forbidden has no known hash in this fixture, so it is treated as a personal edit");
  fs.unlinkSync(path.join(target, "rules/07-forbidden.md"));
  installRules({ sourceRoot: fixture, installRoot: target, host: "codex", log: () => {} });
  assert.equal(read(path.join(target, "rules/07-forbidden.md")), prose,
    "a prose mention of prefix_rule must not block installing a distributed rule");
}

try {
  install("fresh");
  const fresh = path.join(tempRoot, "fresh");
  const common = fs.readdirSync(path.join(sourceRoot, "rules/common"));
  assert.equal(common.length, 7);
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
  checkRetiredRules();
  checkProtectedRules();
  checkManagedRuleUpdates();
  checkInstallerEntrypoint();
  console.log("Rule installation tests passed (migration, backups, custom rules, symlink safety, both hosts, installer dry-run and execution).");
} finally {
  // Only remove the exact private directory returned by mkdtemp; never a caller-supplied path.
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
