"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { createHarnessContext } = require("./core");
const { SCENARIOS_PATH, validateScenarios, runScenarioChecks } = require("./scenario-checks");

const root = path.resolve(__dirname, "../..");
const context = createHarnessContext(root);
runScenarioChecks(context);
assert.deepEqual(context.errors, [], `scenario checks failed:\n${context.errors.join("\n")}`);

const data = JSON.parse(fs.readFileSync(path.join(root, SCENARIOS_PATH), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "harness/manifest.json"), "utf8"));

// Negative test: missing target file must fail
const badTargetErrors = validateScenarios(
  {
    schemaVersion: 1,
    scenarios: Array.from({ length: 25 }, (_, i) =>
      i === 0
        ? { id: "bad-target", prompt: "test missing target skill", expectedTarget: "skills/nonexistent/SKILL.md", expectedLane: "direct", requiredSignals: ["x"] }
        : data.scenarios[i % data.scenarios.length],
    ).map((s, i) => ({ ...s, id: `${s.id}-${i}` })),
  },
  { exists: context.exists, read: context.read, manifest },
);
assert.ok(badTargetErrors.some((e) => e.includes("does not exist")), "missing target must fail");

// Negative test: too few scenarios must fail
const tooFewErrors = validateScenarios(
  { schemaVersion: 1, scenarios: data.scenarios.slice(0, 5) },
  { exists: context.exists, read: context.read, manifest },
);
assert.ok(tooFewErrors.some((e) => e.includes("at least")), "too few scenarios must fail");

// Exercise the evaluator CLI with a stand-in executable at the external host boundary.
function checkEvalCli() {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "cew-eval-test-"));
  const stub = `#!/usr/bin/env node
const fs = require("node:fs");
const output = process.argv.indexOf("--output-last-message");
if (output >= 0) fs.writeFileSync(process.argv[output + 1], process.env.FINAL);
process.stdout.write(process.env.STDOUT);
process.stderr.write(process.env.STDERR);
process.exitCode = Number(process.env.HOST_STATUS);
`;
  try {
    for (const host of ["claude", "codex"]) {
      fs.writeFileSync(path.join(bin, host), stub, { mode: 0o755 });
    }
    const target = "skills/implement/SKILL.md";
    const correct = JSON.stringify({ target });
    const excluded = JSON.stringify({ target: "NONE", reason: `Do not choose ${target}` });
    const run = (host, id, final, expectedStatus, diagnostics = "", hostStatus = 0) => {
      const result = spawnSync(process.execPath, ["scripts/eval-scenarios.js", "--host", host, "--id", id], {
        cwd: root, encoding: "utf8",
        env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, FINAL: final,
          STDOUT: host === "codex" ? correct : final, STDERR: diagnostics, HOST_STATUS: String(hostStatus) },
      });
      assert.ifError(result.error);
      assert.equal(result.status, expectedStatus, `${host} ${id}: ${result.stdout} ${result.stderr}`);
      assert.match(result.stdout, expectedStatus === 0 ? /^PASS /m : /^FAIL /m);
    };
    for (const host of ["claude", "codex"]) {
      run(host, "direct-small-change", excluded, 1, correct);
      run(host, "direct-small-change", "NONE. Do not choose implement.", 1);
      run(host, "direct-small-change", "{}", 1, correct);
      run(host, "direct-small-change", correct, 0);
      run(host, "direct-small-change", correct, 1, "", 1);
      run(host, "non-eng-translate", JSON.stringify({ target: "NONE" }), 0);
    }
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
}

// These executable shims use POSIX shebangs, as do the Linux and macOS CI jobs.
if (process.platform !== "win32") checkEvalCli();

console.log(`Scenario checks tests passed (${data.scenarios.length} routing scenarios verified).`);
