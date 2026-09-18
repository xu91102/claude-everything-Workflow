"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { installHost, selectedFiles, main } = require("../install-host");
const { digest } = require("../install-rules");
const source = path.resolve(__dirname, "../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-host-profiles-"));
const log = [];
const put = (root, file, text) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
const exists = (root, file) => fs.existsSync(path.join(root, file));
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");
const install = (root, host, extra = {}) => installHost({ installRoot: root, host, log: s => log.push(s), ...extra });
try {
  for (const host of ["codex", "claude-code"]) {
    const root = path.join(temp, host);
    install(root, host, { dryRun: true });
    assert.equal(fs.existsSync(root), false, "dry-run writes nothing");
    install(root, host);
    for (const name of ["handoff", "continuous-learning-v2"]) assert.equal(exists(root, `skills/${name}/SKILL.md`), false);
    assert.equal(exists(root, "skills/using-superpowers/SKILL.md"), host === "claude-code");
    assert.equal(exists(root, "hooks/commit-quality.js"), host === "claude-code");
    for (const file of ["commands/code-review.md", "scripts/verify-harness.js", "scripts/learning/projects.js", "rules/03-architecture.md", "rules/04-error-handling.md", "rules/06-comments.md", "rules/common/context-hygiene.md"]) assert.equal(exists(root, file), false, file);
    for (const name of ["systematic-debugging", "spec-gate", "implement", "e2e-testing", "test-driven-development", "code-review"]) assert.equal(exists(root, `skills/${name}/SKILL.md`), true);
    // Actual Markdown links shipped in the selected payload must resolve without omitted skills.
    for (const file of selectedFiles(host).filter(f => f.endsWith(".md"))) {
      for (const match of read(root, file).matchAll(/\]\(([^\s)#]+)(?:#[^)]*)?\)/g)) {
        const target = match[1];
        if (/^(?:https?:|#|\/)/.test(target)) continue;
        assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), target)), `${host}: broken ${file} -> ${target}`);
      }
    }
    put(root, "AGENTS.md", "Personal instructions\n");
    put(root, "config.toml", 'model = "user-choice"\n');
    put(root, "scripts/verify/user.js", "personal\n");
    install(root, host);
    assert.equal(read(root, `AGENTS.md.bak.${digest("Personal instructions\n")}`), "Personal instructions\n");
    assert.equal(read(root, "config.toml"), 'model = "user-choice"\n');
    assert.equal(read(root, "scripts/verify/user.js"), "personal\n");
    install(root, host, { optional: ["handoff", "continuous-learning-v2"] });
    assert.ok(exists(root, "skills/handoff/SKILL.md"));
    assert.ok(exists(root, "scripts/learning/projects.js"));
    if (host === "codex") assert.equal(exists(root, "settings.json"), false);
  }
  const claude = path.join(temp, "claude-code");
  const settings = JSON.parse(read(claude, "settings.json"));
  settings.env = { PERSONAL: "keep" }; settings.mcpServers = { custom: { command: "custom" } };
  settings.hooks.PostToolUse.push({ matcher: "*", hooks: [{ type: "command", command: "echo personal" }] });
  put(claude, "settings.json", JSON.stringify(settings));
  install(claude, "claude-code");
  const merged = JSON.parse(read(claude, "settings.json"));
  assert.equal(merged.env.PERSONAL, "keep");
  assert.equal(merged.mcpServers.custom.command, "custom");
  assert.ok(JSON.stringify(merged.hooks).includes("echo personal"));
  assert.ok(!JSON.stringify(merged.hooks).includes("post:observe"));
  const snapshot = read(claude, "settings.json");
  install(claude, "claude-code");
  assert.equal(read(claude, "settings.json"), snapshot, "settings merge is idempotent");

  // Exercise real upgrade bytes, including CRLF normalization and personal modification preservation.
  const upgrade = path.join(temp, "upgrade");
  const legacy = require("../legacy-install-hashes.json").files;
  const candidates = ["hooks/commit-quality.js", "scripts/learning/projects.js"];
  for (const file of candidates) {
    const content = read(source, file);
    assert.ok(legacy[file].includes(digest(content)));
    put(upgrade, file, content.replace(/\n/g, "\r\n"));
  }
  put(upgrade, "skills/using-superpowers/SKILL.md", "User modified router\n");
  install(upgrade, "codex", { dryRun: true });
  assert.ok(exists(upgrade, candidates[0]));
  install(upgrade, "codex");
  for (const file of candidates) assert.equal(exists(upgrade, file), false);
  assert.equal(read(upgrade, "skills/using-superpowers/SKILL.md"), "User modified router\n");
  assert.ok(log.some(s => s.includes("may remain active")));

  const cold = path.join(temp, "cold-upgrade");
  put(cold, "references/rules/common/context-hygiene.md", read(source, "scripts/verify/fixtures/legacy-context-hygiene.md"));
  install(cold, "claude-code");
  assert.equal(exists(cold, "references/rules/common/context-hygiene.md"), false);
  for (const platform of ["win32", "darwin"]) {
    const root = path.join(temp, `repeat-${platform}-$quoted`);
    for (let i = 0; i < 3; i++) install(root, "claude-code", { platform });
    const settings = JSON.parse(read(root, "settings.json"));
    assert.equal(settings.hooks.PostToolUse.flatMap(e => e.hooks).length, 2);
    assert.equal(settings.hooks.PreToolUse.flatMap(e => e.hooks).length, 1);
    assert.ok(!JSON.stringify(settings.hooks).includes("$HOME"), "custom --home hooks stay isolated");
    install(root, "claude-code", { optional: ["handoff", "continuous-learning-v2"], platform });
    install(root, "claude-code", { platform });
    assert.equal(exists(root, "skills/handoff/SKILL.md"), false);
    assert.equal(exists(root, "skills/continuous-learning-v2/SKILL.md"), false);
    assert.equal(exists(root, "scripts/learning/projects.js"), false);
    assert.ok(!read(root, "settings.json").includes("post:observe"));
  }

  const linked = path.join(temp, "linked"), outside = path.join(temp, "outside");
  fs.mkdirSync(linked); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(linked, "skills"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => install(linked, "codex"), /symlink/i);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(exists(linked, "AGENTS.md"), false, "preflight before all writes");
  assert.throws(() => selectedFiles("codex", ["unknown"]), /Unknown optional/);
  assert.throws(() => main(["--home", "--codex-only"]), /Missing value/);
  assert.throws(() => main(["--with-skill"]), /Missing value/);
  assert.throws(() => main(["--codex-only", "--claude-only", "--home", temp]), /mutually exclusive/);

  const cliHome = path.join(temp, "cli");
  const windows = process.platform === "win32";
  const command = windows ? "powershell.exe" : (process.env.CEW_TEST_BASH || "bash");
  const args = windows ? ["-NoProfile", "-File", path.join(source, "scripts/install.ps1"), "-CodexOnly", "-InstallHome", cliHome, "-WithSkill", "handoff"] : [path.join(source, "scripts/install.sh"), "--codex-only", "--home", cliHome, "--with-skill", "handoff"];
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 30000 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(exists(cliHome, ".codex/skills/handoff/SKILL.md"));
  assert.equal(exists(cliHome, ".claude"), false);
  console.log("Host-profile installation passed: defaults, optional dependencies, links, upgrade, backups, hooks, isolation and CLI.");
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
