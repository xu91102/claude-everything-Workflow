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
