#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");

function verifyEvidence(root) {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  const manifest = read("manifest.json");
  const names = manifest.files.map(row => row.file);
  assert.equal(new Set(names).size, names.length, "duplicate manifest member");
  assert.deepEqual(fs.readdirSync(root).sort(), [...names, "manifest.json"].sort(), "unlisted evidence file");
  for (const item of manifest.files) {
    assert.match(item.file, /^[a-z0-9-]+\.json$/, "unsafe manifest path");
    const body = fs.readFileSync(path.join(root, item.file));
    assert.equal(hash(body), item.sha256, `hash mismatch: ${item.file}`);
    assert.ok(!/\/Users\/|\/home\/|\/private\/|Bearer\s+[A-Za-z0-9]|sk-[A-Za-z0-9]{16}|encrypted_content|auth\.json/.test(body.toString()),
      `private material in ${item.file}`);
  }
  const analysis = read("analysis.json"), rows = read("trial-outcomes.json"), numeric = read("numeric-results.json");
  const programs = read("numeric-programs.json"), patches = read("patches.json"), pairs = read("paired-stats.json");
  assert.equal(rows.length, 88, "need every28 real and60 routing attempt");
  assert.equal(new Set(rows.map(r => r.trial)).size, 88, "duplicate trial");
  assert.equal(patches.length, 88, "missing patch");
  assert.equal(new Set(patches.map(r => r.trial)).size, 88, "duplicate patch");
  for (const row of rows) {
    const patch = patches.find(p => p.trial === row.trial);
    assert.ok(patch && hash(patch.patch) === patch.sha256 && patch.sha256 === row.patch_sha256, "patch binding mismatch");
  }
  assert.equal(programs.reduce((n, p) => n + p.inputs.length, 0), 60, "supported60 inputs changed");
  for (const program of programs) assert.equal(hash(program.python_program), program.python_program_sha256);
  for (const version of new Set(numeric.map(r => r.version))) {
    const groups = numeric.filter(r => r.version === version);
    assert.equal(new Set(groups.map(r => r.group)).size, 9, "missing/duplicate numeric group");
    for (const group of groups) assert.equal(group.cases.length, programs.find(p => p.group === group.group).inputs.length);
    const total = groups.reduce((n, g) => n + g.cases.length, 0);
    const passed = groups.reduce((n, g) => n + g.cases.filter(c => c.passed).length, 0);
    const recorded = analysis.numeric.find(r => r.version === version);
    assert.deepEqual({ passed, total }, { passed: recorded.passed, total: recorded.total }, "numeric totals disagree");
  }
  const real = rows.filter(r => r.kind === "real"), routing = rows.filter(r => r.kind === "routing");
  assert.equal(real.length, 28); assert.equal(routing.length, 60);
  const scenarios = read("routing-scenarios.json").cases, routingSummary = read("routing-summary.json");
  for (const scenario of scenarios) for (const cell of ["gpt-cew", "gpt-fixed"]) {
    const trials = routing.filter(r => r.cell === cell && r.task === scenario.id);
    assert.equal(trials.length, 3, "missing routing repetition");
    assert.equal(new Set(trials.map(r => r.repetition)).size, 3);
    const recorded = routingSummary.rows.find(r => r.id === scenario.id), prefix = cell === "gpt-cew" ? "baseline" : "candidate";
    assert.equal(trials.filter(r => r.auto_pass).length, recorded[prefix + "_pass"]);
    assert.equal(trials.filter(r => r.semantic_pass).length, recorded[prefix + "_semantic_pass"]);
  }
  const complete = r => r.agent.exit === 0 && !r.agent.timed_out && r.resolved;
  for (const cell of ["gpt-cew", "gpt-fixed"]) {
    const arm = real.filter(r => r.cell === cell), metric = analysis.metrics[cell];
    assert.equal(arm.length, 14);
    for (const row of arm.filter(r => r.resolved)) {
      assert.ok(!row.head_modified && !row.tests_modified && row.config_audit.pass);
      assert.equal(row.model_audit.status, "PASS");
      assert.equal(row.target.exit, 0); assert.equal(row.after_full.exit, 0);
      assert.ok(row.target.passed > 0 && row.after_full.passed > 0);
    }
    assert.equal(arm.filter(complete).length, metric.original_suite_complete);
    assert.equal(arm.filter(r => complete(r) && r.quality_status === "PASS").length, metric.quality_adjusted_complete);
    assert.equal(arm.reduce((n, r) => n + r.usage.input_tokens + r.usage.output_tokens, 0), metric.total_tokens, "token totals disagree");
    assert.ok(Math.abs(arm.reduce((n, r) => n + r.agent.duration_s, 0) / 14 - metric.mean_agent_seconds) < 1e-8, "timing totals disagree");
    assert.equal(routing.filter(r => r.cell === cell).length, 30);
    const routed = routing.filter(r => r.cell === cell), cost = routingSummary.cost[cell];
    assert.equal(routed.reduce((n, r) => n + (r.usage?.input_tokens || 0) + (r.usage?.output_tokens || 0), 0), cost.total_tokens);
    assert.equal(routed.every(r => r.usage && !r.usage_error && r.model_audit.status === "PASS"), cost.complete_usage);
    for (const row of arm.filter(r => r.task === "more-itertools-1247")) {
      const score = analysis.numeric.find(n => n.version === cell + "-r" + row.repetition);
      assert.equal(row.quality_status, score.passed === 60 && complete(row) ? "PASS" : "FAIL");
    }
  }
  const translations = read("i18n-results.json");
  assert.equal(translations.length, 8);
  assert.equal(new Set(translations.map(r => r.task + "/" + r.cell + "/" + r.run)).size, 8);
  assert.equal(translations.filter(r => r.passed).length, analysis.i18n.passed);
  assert.ok(translations.every(r => r.compile_exit === 0 && r.test_exit === 0 && r.sources.every(s => s.original_matches)));
  const stability = read("replay-stability.json").results;
  assert.equal(stability.length, 4);
  assert.equal(new Set(stability.map(r => r.version)).size, 4);
  for (const replay of stability) {
    const score = analysis.numeric.find(r => r.version === replay.version);
    assert.ok(replay.stable && replay.frozen_pass_pattern_matches && replay.repetitions >= 2);
    assert.equal(replay.checks_each, 60);
    assert.ok(replay.passed_each.every(n => n === score.passed));
    assert.equal(new Set(replay.semantic_result_sha256).size, 1);
    assert.equal(replay.quality_status, score.passed === 60 ? "PASS" : "FAIL");
  }
  assert.equal(pairs.rows.length, 14);
  assert.equal(new Set(pairs.rows.map(r => r.task + "/" + r.repetition)).size, 14);
  for (const pair of pairs.rows) for (const [cell, prefix] of [["gpt-cew", "baseline"], ["gpt-fixed", "candidate"]]) {
    const row = real.find(r => r.cell === cell && r.task === pair.task && r.repetition === pair.repetition);
    assert.equal(row.usage.input_tokens + row.usage.output_tokens, pair[prefix + "_tokens"]);
    assert.equal(row.agent.duration_s, pair[prefix + "_seconds"]);
  }
  const candidate = analysis.metrics["gpt-fixed"], baseline = analysis.metrics["gpt-cew"];
  assert.equal(pairs.baseline_total_tokens, baseline.total_tokens);
  assert.equal(pairs.candidate_total_tokens, candidate.total_tokens);
  assert.equal(analysis.percent_change.tokens, (candidate.total_tokens / baseline.total_tokens - 1) * 100);
  assert.equal(analysis.percent_change.mean_seconds, (candidate.mean_agent_seconds / baseline.mean_agent_seconds - 1) * 100);
  const routesPass = ["auth-approval", "migration-approval", "plugin-only", "failed-required-check"]
    .every(id => routing.filter(r => r.cell === "gpt-fixed" && r.task === id && r.auto_pass).length === 3);
  const review = read("independent-review.json");
  const noRoutingRegression = routingSummary.rows.every(r => r.candidate_pass >= r.baseline_pass);
  const completeRoutingUsage = Object.values(routingSummary.cost).every(c => c.complete_usage);
  const passes = candidate.quality_adjusted_complete === 14 && routesPass && noRoutingRegression && completeRoutingUsage &&
    candidate.total_tokens < baseline.total_tokens && candidate.mean_agent_seconds < baseline.mean_agent_seconds &&
    review.Standards.status === "PASS" && review.Spec.status === "PASS";
  assert.equal(analysis.status, passes ? "PASS" : "FAIL", "acceptance relabelled despite unmet gates");
  assert.equal(analysis.merge_allowed, false);
  return { integrity: "PASS", recorded_acceptance: analysis.status, real: 28, routing: 60, numeric_inputs: 60 };
}
module.exports = { verifyEvidence };
if (require.main === module) console.log(JSON.stringify(verifyEvidence(process.argv[2] || path.join(__dirname, "../data/final-2026-10-27"))));
