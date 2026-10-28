"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const { verifyEvidence } = require("./verify-evidence");
const { probeResult } = require("./replay-numeric");
const original = path.join(__dirname, "../data/final-2026-10-27");
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cew-evidence-"));
  fs.cpSync(original, dir, { recursive: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function edit(dir, name, mutate, rebind = true) {
  const file = path.join(dir, name), data = JSON.parse(fs.readFileSync(file));
  mutate(data); fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  if (rebind) {
    const m = path.join(dir, "manifest.json"), manifest = JSON.parse(fs.readFileSync(m));
    manifest.files.find(r => r.file === name).sha256 = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    fs.writeFileSync(m, JSON.stringify(manifest, null, 2) + "\n");
  }
}
test("complete failed cohort has valid evidence without becoming a quality pass", () => {
  assert.deepEqual(verifyEvidence(original), { integrity: "PASS", recorded_acceptance: "FAIL", real: 28, routing: 60, numeric_inputs: 60 });
});
test("replay accepts both frozen probe formats: JSON rows and JSON-line stage records", () => {
  assert.deepEqual(probeResult('[{"case":"first","passed":true,"value":"0"}]\n'),
    { case: "first", passed: true, value: "0" });
  assert.deepEqual(probeResult('{"stage":"constructed"}\n{"passed":false,"exception":"ValueError"}\n'),
    { passed: false, exception: "ValueError" });
  assert.equal(probeResult(""), undefined);
});
for (const [name, mutate] of [
  ["missing failed attempt", rows => rows.splice(rows.findIndex(r => r.quality_status === "FAIL"), 1)],
  ["duplicate attempt", rows => { rows[0] = rows[1]; }],
]) test(name + " is rejected even with a fresh manifest hash", t => {
  const dir = fixture(t); edit(dir, "trial-outcomes.json", mutate); assert.throws(() => verifyEvidence(dir));
});
test("inconsistent resource totals cannot be justified by a fresh manifest", t => {
  const dir = fixture(t); edit(dir, "analysis.json", d => d.metrics["gpt-fixed"].total_tokens--);
  assert.throws(() => verifyEvidence(dir), /token totals disagree/);
});
test("relabelled PASS cannot hide shared failures", t => {
  const dir = fixture(t); edit(dir, "analysis.json", d => { d.status = "PASS"; });
  assert.throws(() => verifyEvidence(dir), /acceptance relabelled/);
});
test("repeat consistency cannot relabel a reproducible numerical failure", t => {
  const dir = fixture(t); edit(dir, "replay-stability.json", d => { d.results[0].passed_each = [60, 60]; });
  assert.throws(() => verifyEvidence(dir));
});
test("changed numerical programs fail the frozen program binding", t => {
  const dir = fixture(t); edit(dir, "numeric-programs.json", d => { d[0].python_program += "\n# changed\n"; });
  assert.throws(() => verifyEvidence(dir));
});
test("raw private paths and unbound changes are rejected", t => {
  const dir = fixture(t); edit(dir, "analysis.json", d => { d.extra = "/Users/private-owner/session"; });
  assert.throws(() => verifyEvidence(dir), /private material/);
  edit(dir, "analysis.json", d => { delete d.extra; d.extra = "unbound"; }, false);
  assert.throws(() => verifyEvidence(dir), /hash mismatch/);
});
