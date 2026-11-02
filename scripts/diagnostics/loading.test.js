"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "bin/claude-everything-workflow.js");

function run(t, events, caseId = "small-fix") {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-loading-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const trace = path.join(temp, "trace.jsonl");
  fs.writeFileSync(trace, [...events, { type: "turn.completed" }].map((event) => JSON.stringify(event)).join("\n") + "\n");
  const result = spawnSync(process.execPath, [cli, "loading", "--trace", trace, "--case", caseId, "--json"], { encoding: "utf8" });
  return { result, trace };
}

const output = (body, code = 0) => ({ type: "item.completed", item: { type: "command_execution", command: "cat SKILL.md", aggregated_output: body, exit_code: code } });
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("loading counts observed output and repeated reads, not file mentions or failed empty reads", (t) => {
  const file = "skills/implement/SKILL.md";
  const { result } = run(t, [output(read(file)), output("skills/spec-gate/SKILL.md\n"), output("", 1), output(read(file))]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.files.length, 1);
  assert.equal(report.files[0].path, file);
  assert.equal(report.files[0].reads, 2);
  assert.equal(report.summary.observedCharacters, read(file).length * 2);
  assert.equal(report.summary.repeatedCharacters, read(file).length);
  assert.equal(report.summary.actualFileTokens, null);
  assert.equal(report.coverage, "full-file-tool-output-only");
});

test("loading flags construction references in ordinary acceptance without exposing raw output", (t) => {
  const file = "skills/feature-acceptance/references/project-verification.md";
  const { result } = run(t, [output(read(file) + "\nprivate customer text")], "acceptance-run");
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.assessment, "VIOLATION_OBSERVED");
  assert.deepEqual(report.violations.map((item) => item.path), [file]);
  assert.ok(!result.stdout.includes("private customer text"));
});

test("loading supports CRLF outputs and natural-language question samples with zero skill reads", (t) => {
  const { result } = run(t, [output(read("rules/01-base.md").replace(/\n/g, "\r\n"))], "question");
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).summary.uniqueFiles, 1);
  assert.equal(run(t, [{ type: "item.completed", item: { type: "agent_message", text: "map returns an array" } }], "question").result.status, 0);
});

test("loading rejects an incomplete or malformed trace instead of claiming a passing sample", (t) => {
  const { result, trace } = run(t, [], "question");
  fs.writeFileSync(trace, JSON.stringify(output(read("skills/implement/SKILL.md"))) + "\n");
  const invoke = () => spawnSync(process.execPath, [cli, "loading", "--trace", trace, "--case", "question", "--json"], { encoding: "utf8" });
  assert.equal(JSON.parse(invoke().stdout).assessment, "INSUFFICIENT_EVIDENCE");
  fs.appendFileSync(trace, "{broken\n");
  assert.equal(invoke().status, 2);
  assert.equal(result.status, 0);
});

test("a longer installed variant does not count its reference-body substring a second time", (t) => {
  const { trace } = run(t, []);
  const host = path.join(path.dirname(trace), "host");
  const relative = "skills/implement/SKILL.md";
  fs.mkdirSync(path.dirname(path.join(host, relative)), { recursive: true });
  const personal = read(relative) + "\nPersonal local instruction.\n";
  fs.writeFileSync(path.join(host, relative), personal);
  fs.writeFileSync(trace, [output(personal), { type: "turn.completed" }].map(JSON.stringify).join("\n"));
  const result = spawnSync(process.execPath, [cli, "loading", "--trace", trace, "--case", "small-fix", "--root", host, "--json"], { encoding: "utf8" });
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.reads, 1);
  assert.equal(report.summary.observedCharacters, personal.length);
});
