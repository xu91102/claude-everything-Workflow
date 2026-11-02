"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const source = path.resolve(__dirname, "../..");
const cli = path.join(source, "bin/claude-everything-workflow.js");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cew-doctor-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "home");
  const project = path.join(root, "project");
  fs.mkdirSync(project, { recursive: true });
  const installed = path.join(home, ".codex");
  for (const dir of ["skills", "rules", "harness", "references", "agents", "commands"]) {
    fs.cpSync(path.join(source, dir), path.join(installed, dir), { recursive: true });
  }
  const run = (extra = []) => spawnSync(process.execPath, [cli, "doctor", "--host", "codex", "--home", home,
    "--project", project, "--json", ...extra], { encoding: "utf8" });
  return { root, home, project, installed, run };
}

test("doctor detects changed bodies even when the installed manifest is identical, without writes", (t) => {
  const { installed, run } = fixture(t);
  const file = path.join(installed, "skills/using-superpowers/SKILL.md");
  const personal = fs.readFileSync(file, "utf8") + "\nPersonal instruction.\n";
  fs.writeFileSync(file, personal);
  const result = run();
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const candidate = report.hosts[0].skills.find((s) => s.name === "using-superpowers").candidates[0];
  assert.equal(candidate.manifestMatch, true);
  assert.equal(candidate.content.status, "DIFFERENT");
  assert.equal(candidate.selection, "UNVERIFIED");
  assert.equal(fs.readFileSync(file, "utf8"), personal);
  assert.deepEqual(fs.readdirSync(path.dirname(file)).filter((name) => name.includes("bak")), []);
});

test("a discovered skill is blocked when its required reference is missing", (t) => {
  const { installed, run } = fixture(t);
  fs.unlinkSync(path.join(installed, "skills/feature-acceptance/references/project-verification.md"));
  const result = run();
  const skill = JSON.parse(result.stdout).hosts[0].skills.find((s) => s.name === "feature-acceptance");
  assert.equal(skill.discovery, "DISCOVERED");
  assert.equal(skill.candidates[0].readiness, "BLOCKED");
  assert.ok(skill.candidates[0].dependencies.some((dep) => dep.reference.endsWith("project-verification.md") && dep.status === "MISSING"));
});

test("Claude rule resolution preserves personal common rules ahead of migrated references", (t) => {
  const { home, project, installed } = fixture(t);
  const dest = path.join(home, ".claude");
  fs.renameSync(installed, dest);
  fs.mkdirSync(path.join(dest, "references/rules"), { recursive: true });
  fs.renameSync(path.join(dest, "rules/common"), path.join(dest, "references/rules/common"));
  const invoke = () => spawnSync(process.execPath, [cli, "doctor", "--host", "claude", "--home", home, "--project", project, "--json"], { encoding: "utf8" });
  let report = JSON.parse(invoke().stdout);
  let dep = report.hosts[0].skills.find((s) => s.name === "using-superpowers").candidates[0].dependencies.find((d) => d.reference === "rules/common/testing.md");
  assert.equal(dep.path, path.join(dest, "references/rules/common/testing.md"));
  fs.mkdirSync(path.join(dest, "rules/common"));
  fs.writeFileSync(path.join(dest, "rules/common/testing.md"), "personal rule");
  report = JSON.parse(invoke().stdout);
  dep = report.hosts[0].skills.find((s) => s.name === "using-superpowers").candidates[0].dependencies.find((d) => d.reference === "rules/common/testing.md");
  assert.equal(dep.path, path.join(dest, "rules/common/testing.md"));
  assert.equal(dep.status, "DIFFERENT");
});

test("npm and cached plugin copies are duplicate candidates, never claimed as active", (t) => {
  const { installed, run } = fixture(t);
  const plugin = path.join(installed, "plugins/cache/cew/claude-everything-workflow/0.2.5");
  fs.mkdirSync(path.join(plugin, ".codex-plugin"), { recursive: true });
  fs.writeFileSync(path.join(plugin, ".codex-plugin/plugin.json"), '{"name":"claude-everything-workflow"}');
  fs.cpSync(path.join(installed, "skills"), path.join(plugin, "skills"), { recursive: true });
  const report = JSON.parse(run().stdout);
  assert.ok(report.issues.some((issue) => issue.code === "DUPLICATE_CANDIDATES"));
  const candidates = report.hosts[0].skills.find((s) => s.name === "using-superpowers").candidates;
  assert.equal(candidates.length, 2);
  assert.equal(candidates[1].selection, "UNVERIFIED");
  fs.rmSync(path.join(plugin, "skills"), { recursive: true });
  fs.symlinkSync(path.join(installed, "skills"), path.join(plugin, "skills"), "dir");
  assert.equal(JSON.parse(run().stdout).hosts[0].skills[0].candidates.length, 1);
});

test("new missing local references in an installed body block readiness", (t) => {
  const { installed, run } = fixture(t);
  fs.appendFileSync(path.join(installed, "skills/implement/SKILL.md"), '\nRead `rules/personal-required.md` first.\n');
  const candidate = JSON.parse(run().stdout).hosts[0].skills.find((s) => s.name === "implement").candidates[0];
  assert.equal(candidate.readiness, "BLOCKED");
  assert.ok(candidate.dependencies.some((dep) => dep.reference === "rules/personal-required.md" && dep.status === "MISSING"));
});

test("doctor rejects malformed options", (t) => {
  const { run } = fixture(t);
  assert.equal(run(["--host"]).status, 2);
  assert.equal(run(["--unknown"]).status, 2);
});

test("a malformed discovered skill is not statically ready", (t) => {
  const { installed, run } = fixture(t);
  fs.writeFileSync(path.join(installed, "skills/implement/SKILL.md"), '---\nname: [unterminated\n---\n');
  const candidate = JSON.parse(run().stdout).hosts[0].skills.find((s) => s.name === "implement").candidates[0];
  assert.equal(candidate.readiness, "BLOCKED");
  assert.equal(candidate.metadata.status, "INVALID");
});

test("doctor reports manifest drift separately and resolves project rules from the caller's directory", (t) => {
  const { installed, project, run } = fixture(t);
  const file = path.join(installed, "harness/manifest.json");
  fs.appendFileSync(file, "\n");
  fs.mkdirSync(path.join(project, "rules/common"), { recursive: true });
  fs.writeFileSync(path.join(project, "rules/common/testing.md"), "project-specific test policy");
  const report = JSON.parse(run().stdout);
  const candidate = report.hosts[0].skills.find((s) => s.name === "using-superpowers").candidates[0];
  assert.equal(candidate.manifestMatch, false);
  assert.ok(report.issues.some((item) => item.code === "MANIFEST_DIFFERENT"));
  assert.equal(candidate.dependencies.find((d) => d.reference === "rules/common/testing.md").path, path.join(project, "rules/common/testing.md"));
});

test("readable personal references without a distribution counterpart are unverified, not missing", (t) => {
  const { installed, run } = fixture(t);
  const file = path.join(installed, "skills/implement/SKILL.md");
  fs.appendFileSync(file, '\nRead [guide](references/personal.md).\n');
  fs.writeFileSync(path.join(installed, "skills/implement/references/personal.md"), "Personal guide.");
  const candidate = JSON.parse(run().stdout).hosts[0].skills.find((s) => s.name === "implement").candidates[0];
  assert.equal(candidate.readiness, "UNVERIFIED");
  assert.equal(candidate.dependencies.find((d) => d.reference.endsWith("personal.md")).status, "NO_REFERENCE");
});

test("router references in fenced code participate in readiness checks", (t) => {
  const { installed, run } = fixture(t);
  fs.unlinkSync(path.join(installed, "agents/harness-optimizer.md"));
  const report = JSON.parse(run().stdout);
  const candidate = report.hosts[0].skills.find((s) => s.name === "using-superpowers").candidates[0];
  assert.equal(candidate.readiness, "BLOCKED");
  assert.ok(candidate.dependencies.some((dep) => dep.reference === "agents/harness-optimizer.md" && dep.status === "MISSING"));
});

test("personal scripts resolve from the installed skill directory without a distribution counterpart", (t) => {
  const { installed, run } = fixture(t);
  const skill = path.join(installed, "skills/visual-companion");
  const entry = path.join(skill, "SKILL.md");
  const script = path.join(skill, "scripts/personal-check.js");
  const body = '"use strict";\n// Private read-only helper.\n';
  fs.appendFileSync(entry, '\nRead `scripts/personal-check.js` before use.\n');
  fs.writeFileSync(script, body);
  const candidate = JSON.parse(run().stdout).hosts[0].skills.find((s) => s.name === "visual-companion").candidates[0];
  assert.equal(candidate.readiness, "UNVERIFIED");
  const dependency = candidate.dependencies.find((d) => d.reference.endsWith("personal-check.js"));
  assert.equal(dependency.reference, "skills/visual-companion/scripts/personal-check.js");
  assert.equal(dependency.path, script);
  assert.equal(dependency.status, "NO_REFERENCE");
  assert.equal(dependency.expectedHash, null);
  assert.match(dependency.actualHash, /^[a-f0-9]{64}$/);
  assert.equal(fs.readFileSync(script, "utf8"), body);
});

test("missing distributed sibling references stay blocked even if a root file has the same name", (t) => {
  const { installed, run } = fixture(t);
  const sibling = path.join(installed, "skills/visual-companion/scripts/start-server.sh");
  fs.unlinkSync(sibling);
  fs.mkdirSync(path.join(installed, "scripts"));
  fs.writeFileSync(path.join(installed, "scripts/start-server.sh"), "root helper, not the skill's server\n");
  const candidate = JSON.parse(run().stdout).hosts[0].skills.find((s) => s.name === "visual-companion").candidates[0];
  assert.equal(candidate.readiness, "BLOCKED");
  assert.ok(candidate.dependencies.some((d) => d.path === sibling && d.status === "MISSING"));
});
