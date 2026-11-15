"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "../..");
const skill = "skills/continuous-learning-v2";
const observer = `${skill}/hooks/observe-v2.js`;

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cew-learning-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const data = path.join(cwd, "data");
  const config = { homunculus: { data_root: data } };
  const configPath = path.join(cwd, skill, "config.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config));
  return { cwd, data };
}

function run(cwd, script, args, input) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd, input, encoding: "utf8", env: { ...process.env, HOME: cwd, USERPROFILE: cwd, XDG_DATA_HOME: cwd },
    timeout: 10000,
  });
  assert.ifError(result.error);
  return result;
}

function writeInstinct(base, filename, confidence) {
  const directory = path.join(base, "personal");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, filename), `---\nconfidence: ${confidence}\n---\nA fixture instinct.\n`);
}

test("project migration preview creates neither registry nor instinct files", (t) => {
  const { cwd, data } = fixture(t);
  const legacy = path.join(cwd, "legacy");
  writeInstinct(legacy, "keep.md", 0.8);
  const args = ["--source", legacy];
  for (const flags of [[], ["--dry-run"]]) {
    const preview = run(cwd, "scripts/learning/migrate-homunculus.js", [...args, ...flags]);
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /keep\.md/);
    assert.equal(fs.existsSync(data), false);
  }
  const applied = run(cwd, "scripts/learning/migrate-homunculus.js", [...args, "--apply"]);
  assert.equal(applied.status, 0, applied.stderr);
  const registry = JSON.parse(fs.readFileSync(path.join(data, "projects.json"), "utf8"));
  const [id] = Object.keys(registry.projects);
  assert.equal(fs.existsSync(path.join(data, "projects", id, "instincts/personal/keep.md")), true);
});

test("conflicting preview and apply flags are rejected without writes", (t) => {
  const { cwd, data } = fixture(t);
  const instincts = path.join(data, "projects/example/instincts");
  writeInstinct(instincts, "candidate.md", 0.8);
  const commands = [
    ["scripts/learning/migrate-homunculus.js", "--source", instincts],
    ["scripts/learning/promote.js", "--project-id", "example"],
  ];
  for (const [script, ...args] of commands) {
    const result = run(cwd, script, [...args, "--dry-run", "--apply"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--dry-run.*--apply/);
    assert.deepEqual(fs.readdirSync(data), ["projects"]);
    assert.deepEqual(fs.readdirSync(path.join(data, "projects")), ["example"]);
  }
});

test("an invalid promotion threshold fails before any global write", (t) => {
  const { cwd, data } = fixture(t);
  writeInstinct(path.join(data, "projects/example/instincts"), "candidate.md", 0.8);
  for (const value of [[], [""], ["abc"], ["0.4oops"], ["0x0"], ["Infinity"], ["-0.1"], ["1.1"]]) {
    const result = run(cwd, "scripts/learning/promote.js",
      ["--project-id", "example", "--apply", "--min-confidence", ...value]);
    assert.notEqual(result.status, 0, JSON.stringify(value));
    assert.match(result.stderr, /--min-confidence/);
    assert.equal(fs.existsSync(path.join(data, "global")), false);
  }
  for (const flags of [["--min-confidence=abc"], ["--min-confidence", "0.7", "--min-confidence", "abc"]]) {
    const result = run(cwd, "scripts/learning/promote.js", ["--project-id", "example", "--apply", ...flags]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--min-confidence/);
    assert.equal(fs.existsSync(path.join(data, "global")), false);
  }
});

test("promotion copies only candidates with a valid confidence at or above the threshold", (t) => {
  const { cwd, data } = fixture(t);
  const instincts = path.join(data, "projects/example/instincts");
  writeInstinct(instincts, "at-threshold.md", 0.7);
  writeInstinct(instincts, "low.md", 0.6);
  writeInstinct(instincts, "malformed.md", "0.9oops");
  writeInstinct(instincts, "out-of-range.md", 1.5);
  const args = ["--project-id", "example", "--min-confidence", "0.7"];
  const preview = run(cwd, "scripts/learning/promote.js", [...args, "--dry-run"]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(fs.existsSync(path.join(data, "global")), false);
  const result = run(cwd, "scripts/learning/promote.js", [...args, "--apply"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(path.join(data, "global/instincts/personal")), ["at-threshold.md"]);
});

test("observation leaves the profile untouched with default, missing or invalid config", (t) => {
  const { cwd } = fixture(t);
  const configPath = path.join(cwd, ".claude", skill, "config.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const input = JSON.stringify({ tool: "Edit", tool_name: "Edit", cwd, session_id: "fixture" });
  const shipped = fs.readFileSync(path.join(root, skill, "config.json"), "utf8");
  for (const config of [null, "{", shipped, '{"observation":{"enabled":"false"}}', "null"]) {
    if (config !== null) fs.writeFileSync(configPath, config);
    const result = run(cwd, observer, ["post"], input);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(cwd).sort(), [".claude", "skills"]);
    assert.deepEqual(fs.readdirSync(path.join(cwd, ".claude")), ["skills"]);
  }
});
