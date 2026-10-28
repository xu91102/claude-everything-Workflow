"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const hook = path.resolve(__dirname, "../../hooks/commit-quality.js");
const input = JSON.stringify({ tool_input: { command: 'git commit -m "fix: fixture"' } });
const fixtureToken = ["CEW_TEST_ONLY_", "12345678901234567890"].join("");

function check(files, { before = {}, raw = input, initialize = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cew-commit-quality-"));
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  const write = (entries) => {
    for (const [file, body] of Object.entries(entries)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), body);
    }
  };
  try {
    if (initialize) {
      git("init", "--quiet");
      if (Object.keys(before).length) {
        write(before);
        git("add", "--all");
        git("-c", "core.hooksPath=/dev/null", "-c", "user.name=CEW fixture", "-c",
          "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "fixture baseline");
      }
      write(files);
      git("add", "--all");
    }
    const result = spawnSync(process.execPath, ["-e",
      "process.stdout.write(JSON.stringify(require(process.argv[1]).run(process.argv[2])))", hook, raw],
    { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("reports the changed file and source line rather than the final diff file", () => {
  const result = check({
    "src/a.js": "const first = 1;\nconst second = 2;\nconsole.log(first);\n",
    "src/z.js": "export const last = 3;\n",
  });
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /src\/a\.js:3\b/);
  assert.doesNotMatch(result.stderr, /src\/z\.js:/);
});

test("keeps secret blocking and attributes the secret to its own file", () => {
  const result = check({
    "src/a.js": `const first = 1;\nconst token = "${fixtureToken}";\n`,
    "src/z.js": "export const last = 3;\n",
  });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /src\/a\.js:2\b/);
  assert.doesNotMatch(result.stderr, /src\/z\.js:/);
});

test("uses new-file line numbers across multiple hunks", () => {
  const before = Array.from({ length: 60 }, (_, i) => `const value${i} = ${i};`);
  const after = [...before];
  after[4] = "console.log(value0);";
  after[49] = "debugger;";
  const result = check({ "a.js": after.join("\n") + "\n" },
    { before: { "a.js": before.join("\n") + "\n" } });
  assert.match(result.stderr, /a\.js:5\b/);
  assert.match(result.stderr, /a\.js:50\b/);
});

test("decodes Git-quoted names with spaces, quotes, backslashes and UTF-8", () => {
  const file = 'src/odd "name"\\文件.js';
  const result = check({ [file]: "debugger;\n" });
  assert.equal(result.exitCode, 0);
  assert.ok(result.stderr.includes(file + ":1"), result.stderr);
});

test("preserves literal trailing spaces while excluding the diff metadata delimiter", () => {
  const file = "src/trailing space.js ";
  const result = check({ [file]: "debugger;\n" });
  assert.ok(result.stderr.includes(file + ":1"), result.stderr);
});

test("an added line beginning with plus signs is still scanned", () => {
  const result = check({ "a.txt": `++token = "${fixtureToken}";\n` });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /a\.txt:1\b/);
});

test("a debug warning does not disclose a secret on the same source line", () => {
  const value = fixtureToken;
  const result = check({ "a.js": `const token = "${value}"; console.log(token);\n` });
  assert.equal(result.exitCode, 2);
  assert.ok(!result.stderr.includes(value), result.stderr);
  assert.match(result.stderr, /a\.js:1\b/);
});

test("unchanged and removed lines do not create new warnings", () => {
  const result = check({ "a.js": "const retained = 1;\nconst added = 2;\n" },
    { before: { "a.js": "console.log('old');\nconst retained = 1;\n" } });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, undefined);
});

test("malformed input and unrelated commands do not trigger a commit check", () => {
  assert.equal(check({}, { raw: "not json", initialize: false }).exitCode, 0);
  const result = check({}, { raw: JSON.stringify({ tool_input: { command: "git status" } }), initialize: false });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, undefined);
});

test("commit-message style is a warning, not a blocker", () => {
  const result = check({ "a.js": "export const ok = 1;\n" },
    { raw: JSON.stringify({ tool_input: { command: 'git commit -m "fixture"' } }) });
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /Commit message/);
});

test("an unavailable staged diff is reported without claiming it was checked", () => {
  const result = check({}, { initialize: false });
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /未运行|无法检查/);
});
