#!/usr/bin/env node
"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { spawnSync } = require("node:child_process"), { parseArgs } = require("node:util");
const { verifyEvidence } = require("./verify-evidence");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function probeResult(stdout) {
  const rows = stdout.split("\n").flatMap(line => {
    try { const value = JSON.parse(line); return Array.isArray(value) ? value : [value]; }
    catch { return []; }
  });
  return rows.findLast(r => typeof r.passed === "boolean");
}
function replay({ root, checkout, version, python = "python3", repeat = 2 }) {
  verifyEvidence(root);
  if (!Number.isInteger(repeat) || repeat < 2) throw Error("At least two identical-artifact repetitions are required");
  const programs = JSON.parse(fs.readFileSync(path.join(root, "numeric-programs.json")));
  const expected = JSON.parse(fs.readFileSync(path.join(root, "numeric-results.json"))).filter(r => r.version === version);
  if (expected.length !== 9) throw Error("Unknown artifact version");
  const source = fs.readFileSync(path.join(checkout, "more_itertools/more.py"), "utf8"), sourceHash = hash(source);
  if (!expected.every(r => r.source_sha256 === sourceHash)) throw Error("Checkout is not the frozen artifact source");
  const runs = [];
  for (let n = 0; n < repeat; n++) {
    const rows = [];
    for (const program of programs) for (const [index, input] of program.inputs.entries()) {
      const result = spawnSync(python, ["-B", "-c", program.python_program], {
        input: JSON.stringify({ ...input, source, support: checkout }), encoding: "utf8", timeout: program.timeout_ms,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }, cwd: require("node:os").tmpdir(),
      });
      const row = probeResult(result.stdout || "") || { passed: false, timed_out: result.error?.code === "ETIMEDOUT" };
      if (result.status !== 0 || result.error) row.passed = false;
      rows.push({ group: program.group, index, passed: row.passed,
        ...Object.fromEntries(["value", "index", "length", "exception"].filter(k => k in row).map(k => ["actual_" + k, row[k]])) });
    }
    runs.push(rows);
  }
  const stable = runs.every(rows => JSON.stringify(rows) === JSON.stringify(runs[0]));
  const matches = runs.every(rows => rows.every(row => row.passed === expected.find(g => g.group === row.group).cases[row.index].passed));
  return { version, source_sha256: sourceHash, repetitions: repeat, checks_each: runs[0].length,
    passed_each: runs.map(rows => rows.filter(r => r.passed).length), stable, frozen_pass_pattern_matches: matches,
    semantic_result_sha256: runs.map(rows => hash(JSON.stringify(rows))), quality_status: runs[0].every(r => r.passed) ? "PASS" : "FAIL" };
}
module.exports = { replay, probeResult };
if (require.main === module) {
  const { values } = parseArgs({ options: { root: { type: "string" }, checkout: { type: "string" }, version: { type: "string" }, python: { type: "string" }, repeat: { type: "string" } } });
  if (!values.checkout || !values.version) throw Error("Pass --checkout and --version; the checkout must contain the frozen artifact");
  const result = replay({ ...values, root: values.root || path.join(__dirname, "../data/final-2026-10-27"), repeat: Number(values.repeat || 2) });
  console.log(JSON.stringify(result, null, 2));
  if (!result.stable || !result.frozen_pass_pattern_matches) process.exitCode = 1;
}
