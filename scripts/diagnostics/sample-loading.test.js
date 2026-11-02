"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

// A real external process boundary: emulate Codex handling SIGTERM with exit 0.
test("sampling stops after a timed-out process even when it exits zero", { skip: process.platform === "win32" }, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cew-sampler-timeout-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fakeBin = path.join(root, "bin");
  const output = path.join(root, "results");
  fs.mkdirSync(fakeBin);
  fs.writeFileSync(path.join(fakeBin, "codex"), '#!/usr/bin/env node\nif (process.argv.includes("--version")) { console.log("fake Codex"); process.exit(0); }\nprocess.on("SIGTERM", () => process.exit(0));\nsetInterval(() => {}, 100);\n', { mode: 0o755 });
  const result = spawnSync(process.execPath, [path.join(__dirname, "sample-loading.js"), "--output", output, "--timeout-ms", "1000"], {
    encoding: "utf8", env: { ...process.env, PATH: fakeBin + path.delimiter + process.env.PATH }, timeout: 10000,
  });
  assert.equal(result.status, 1, result.stderr);
  const summary = JSON.parse(fs.readFileSync(path.join(output, "summary.json"), "utf8"));
  assert.equal(summary.length, 1);
  assert.match(summary[0].error, /ETIMEDOUT/);
  assert.equal(summary[0].commandExitCode, 0);
  t.after(() => fs.rmSync(summary[0].fixture, { recursive: true, force: true }));
});

test("sampling includes shared user skills alongside a custom Codex home", { skip: process.platform === "win32" }, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cew-sampler-shared-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fakeBin = path.join(root, "bin");
  const output = path.join(root, "results");
  const fixtureHome = path.join(root, "user-home");
  const file = path.join(fixtureHome, ".agents/skills/personal/SKILL.md");
  const body = "# Shared personal skill\nUnique shared user instructions observed in a complete tool output.\n";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  fs.mkdirSync(fakeBin);
  const events = [
    { type: "item.completed", item: { type: "command_execution", command: `cat ${file}`, aggregated_output: body, exit_code: 0 } },
    { type: "turn.completed" },
  ];
  fs.writeFileSync(path.join(fakeBin, "codex"), '#!/usr/bin/env node\nif (process.argv.includes("--version")) { console.log("fake Codex"); process.exit(0); }\n' +
    'const events = ' + JSON.stringify(events) + ';\nfor (const event of events) console.log(JSON.stringify(event));\n', { mode: 0o755 });
  const result = spawnSync(process.execPath, [path.join(__dirname, "sample-loading.js"), "--output", output, "--case", "question"], {
    encoding: "utf8", timeout: 10000,
    env: { ...process.env, HOME: fixtureHome, CODEX_HOME: path.join(root, "custom-codex"), PATH: fakeBin + path.delimiter + process.env.PATH },
  });
  assert.equal(result.status, 0, result.stderr);
  const [report] = JSON.parse(fs.readFileSync(path.join(output, "summary.json"), "utf8"));
  t.after(() => fs.rmSync(report.fixture, { recursive: true, force: true }));
  assert.equal(report.loading.summary.reads, 1);
  assert.equal(report.loading.assessment, "VIOLATION_OBSERVED");
  assert.equal(report.loading.files[0].path, "skills/personal/SKILL.md");
  assert.deepEqual(report.loading.files[0].candidatePaths, [file]);
});
