"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const source = path.resolve(__dirname, "../..");
const legacyResearch = fs.readFileSync(path.join(__dirname, "fixtures/legacy-research.md"), "utf8"); // de622ec
const legacyHook = 'node "$HOME/.claude/hooks/runtime/run-with-flags.js" session:start "$HOME/.claude/hooks/session-start.js" minimal,standard,strict'; // 36d305fc
const put = (root, file, body) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
};
function snapshot(root) {
  if (!fs.existsSync(root)) return {};
  const result = {};
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    result[entry.name] = entry.isDirectory() ? snapshot(path.join(root, entry.name)) : fs.readFileSync(path.join(root, entry.name), "utf8");
  }
  return result;
}
function install(home, args = []) {
  // Exercise the public CLI and its complete host installation/upgrade path.
  const result = spawnSync(process.execPath, [path.join(source, "bin/claude-everything-workflow.js"), "install", "--home", home, ...args], { encoding: "utf8", timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
function checkSkills(temp) {
  for (const scenario of ["modified", "unrelated", "known"]) {
    const home = path.join(temp, scenario);
    const original = scenario === "known" ? legacyResearch.replace(/\n/g, "\r\n") : scenario === "modified" ? legacyResearch + "\nMy custom instructions\n" : "---\nname: research\n---\nAn independently installed research skill.\n";
    for (const host of [".codex", ".claude"]) {
      put(home, `${host}/skills/research/SKILL.md`, original);
      put(home, `${host}/skills/research/personal-notes.md`, "Keep notes\n");
      put(home, `${host}/skills/wayfinder/SKILL.md`, "My unrelated wayfinder skill\n");
    }
    const before = snapshot(home);
    install(home, ["--dry-run"]);
    assert.deepEqual(snapshot(home), before, "upgrade dry-run must not write");
    const output = install(home);
    for (const host of [".codex", ".claude"]) {
      const file = path.join(home, host, "skills/research/SKILL.md");
      if (scenario === "known") assert.equal(fs.existsSync(file), false, "unmodified historical CEW content must be retired");
      else assert.equal(fs.readFileSync(file, "utf8"), original, `${scenario} research must survive`);
      assert.equal(fs.readFileSync(path.join(home, host, "skills/wayfinder/SKILL.md"), "utf8"), "My unrelated wayfinder skill\n");
      assert.equal(fs.readFileSync(path.join(home, host, "skills/research/personal-notes.md"), "utf8"), "Keep notes\n");
    }
    assert.match(output, /Preserv.*(?:modified|unknown)/i, "preserved files should be reported");
    const after = snapshot(home);
    install(home);
    assert.deepEqual(snapshot(home), after, "repeated upgrade must be idempotent");
  }
}
function checkHooks(temp) {
  const home = path.join(temp, "hooks");
  const root = path.join(home, ".claude");
  const hookRoot = process.platform === "win32" ? root : root.replace(/[\\$`"]/g, "\\$&");
  const ownedAbsolute = legacyHook.replaceAll("$HOME/.claude", hookRoot);
  const personal = [
    'node "/opt/other-tool/hooks/session-start.js"',
    'node "/opt/other-tool/scripts/hooks/run-with-flags.js" session:start "/opt/other-tool/hooks/session-start.js" minimal,standard,strict',
    'node "C:\\other-tool\\hooks\\session-start.js"',
    'node "C:/other-tool/hooks/session-start.js"',
    'node "~/.other-tool/hooks/session-start.js"',
    'node hooks/session-start.js',
    'node "$HOME/.claude/hooks/session-start.js" --personal',
    legacyHook + ' --custom',
    legacyHook.replaceAll("$HOME/.claude", `${hookRoot}/other-tool`),
    `echo '${legacyHook}'`,
  ];
  const hooks = [...personal, legacyHook, ownedAbsolute].map(command => ({ type: "command", command }));
  put(root, "settings.json", JSON.stringify({ env: { KEEP: "yes" }, hooks: { SessionStart: [{ matcher: "*", hooks }] } }));
  const before = snapshot(home);
  install(home, ["--claude-only", "--dry-run"]);
  assert.deepEqual(snapshot(home), before);
  install(home, ["--claude-only"]);
  const settings = JSON.parse(fs.readFileSync(path.join(root, "settings.json"), "utf8"));
  assert.deepEqual(settings.hooks.SessionStart.flatMap(entry => entry.hooks.map(h => h.command)), personal, "only exact CEW legacy commands at CEW paths may be removed");
  assert.equal(settings.env.KEEP, "yes");
  const after = snapshot(home);
  install(home, ["--claude-only"]);
  assert.deepEqual(snapshot(home), after);
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-install-ownership-"));
try {
  const errors = [];
  for (const check of [checkSkills, checkHooks]) {
    try { check(temp); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, "Installation ownership regressions");
  console.log("Installation ownership passed: personal skills/hooks, known CEW retirement, dry-run and repeated upgrade.");
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
