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
fs.writeFileSync(process.env.PROMPT_FILE, process.argv.at(-1));
const output = process.argv.indexOf("--output-last-message");
const samples = JSON.parse(fs.readFileSync(process.env.SAMPLES_FILE, "utf8"));
const { final, hostStatus = 0, diagnostics = "" } = samples.shift();
fs.writeFileSync(process.env.SAMPLES_FILE, JSON.stringify(samples));
if (output >= 0) fs.writeFileSync(process.argv[output + 1], final);
process.stdout.write(output >= 0 ? process.env.DECOY : final);
process.stderr.write(diagnostics);
process.exitCode = hostStatus;
`;
  const promptFile = path.join(bin, "prompt.txt");
  const samplesFile = path.join(bin, "samples.json");
  try {
    for (const host of ["claude", "codex"]) {
      fs.writeFileSync(path.join(bin, host), stub, { mode: 0o755 });
    }
    const target = "skills/implement/SKILL.md";
    const correct = JSON.stringify({ target });
    const excluded = JSON.stringify({ target: "NONE", reason: `Do not choose ${target}` });
    const runSamples = (host, id, samples, verdict) => {
      fs.writeFileSync(samplesFile, JSON.stringify(samples));
      const args = ["scripts/eval-scenarios.js", "--host", host, "--id", id];
      if (samples.length > 1) args.push("--repeat", String(samples.length));
      const result = spawnSync(process.execPath, args, {
        cwd: root, encoding: "utf8",
        env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH,
          SAMPLES_FILE: samplesFile, PROMPT_FILE: promptFile, DECOY: correct },
      });
      assert.ifError(result.error);
      assert.equal(result.status, verdict === "PASS" ? 0 : 1, `${host} ${id}: ${result.stdout} ${result.stderr}`);
      assert.ok(result.stdout.startsWith(`${verdict} ${id} `), result.stdout);
      assert.deepEqual(JSON.parse(fs.readFileSync(samplesFile, "utf8")), []);
      return result.stdout;
    };
    const run = (host, id, final, expectedStatus, diagnostics = "", hostStatus = 0) =>
      runSamples(host, id, [{ final, diagnostics, hostStatus }], expectedStatus === 0 ? "PASS" : "FAIL");
    for (const host of ["claude", "codex"]) {
      run(host, "direct-small-change", excluded, 1, correct);
      run(host, "direct-small-change", `Rejected example: ${correct}. Final choice: NONE.`, 1);
      const fence = "`".repeat(3);
      run(host, "direct-small-change", [fence + "json", correct, fence].join("\r\n"), 0);
      run(host, "direct-small-change", [fence, correct, fence].join("\n"), 0);
      run(host, "direct-small-change", [fence + "json", correct].join("\n"), 1);
      run(host, "direct-small-change", [correct, fence].join("\n"), 1);
      run(host, "direct-small-change", [correct, correct].join("\n"), 1);
      run(host, "direct-small-change", "NONE. Do not choose implement.", 1);
      run(host, "direct-small-change", "{}", 1, correct);
      run(host, "direct-small-change", correct, 0);
      const prompt = fs.readFileSync(promptFile, "utf8");
      assert.ok(!prompt.includes("第一个 Skill 或规则"), "the host question must not ask for the first routing hop");
      assert.ok(!prompt.includes(target), "keep the expected answer out of the host prompt");
      const router = JSON.stringify({ target: "skills/using-superpowers/SKILL.md" });
      run(host, "direct-small-change", router, 1);
      run(host, "workflow-advice", router, 0);
      const right = { final: correct };
      const wrong = { final: router };
      const repeat = (samples, verdict) => runSamples(host, "direct-small-change", samples, verdict);
      repeat([right, right], "PASS");
      repeat([wrong, wrong], "FAIL");
      repeat([right, wrong], "UNSTABLE");
      assert.match(repeat([right, { final: "", hostStatus: 1 }], "FAIL"), /host-error/);
      assert.match(repeat([right, { final: "{}" }], "FAIL"), /invalid-answer/);
      const incomplete = repeat([right, wrong, { final: "invalid" }, { final: correct, hostStatus: 1 }], "FAIL");
      assert.match(incomplete, /invalid-answer/);
      assert.match(incomplete, /host-error/);
      run(host, "direct-small-change", correct, 1, "", 1);
      run(host, "non-eng-translate", JSON.stringify({ target: "NONE" }), 0);
      const debug = JSON.stringify({ target: "skills/systematic-debugging/SKILL.md" });
      const acceptance = JSON.stringify({ target: "skills/feature-acceptance/SKILL.md" });
      run(host, "e2e-flaky-fix", debug, 0);
      run(host, "e2e-flaky-fix", acceptance, 1);
      run(host, "e2e-playwright-tests", acceptance, 0);
    }
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
}

// These executable shims use POSIX shebangs, as do the Linux and macOS CI jobs.
if (process.platform !== "win32") checkEvalCli();

console.log(`Scenario checks tests passed (${data.scenarios.length} routing scenarios verified).`);
