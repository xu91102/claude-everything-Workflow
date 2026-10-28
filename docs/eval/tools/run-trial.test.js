"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const runner = path.join(__dirname, "run-trial.js");
const passReport = '<testsuite><testcase classname="fixture" name="passes"/></testsuite>';
const failReport = '<testsuite><testcase classname="fixture" name="passes"/>'
  + '<testcase classname="fixture" name="known_failure"><failure/></testcase></testsuite>';

// Exercise the public CLI and persisted scores; only the external model/pytest tools are fixtures.
function fixture(t, { testName = "test_issue.py", configName = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cew-trial-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, "repos/fixture");
  fs.mkdirSync(repo, { recursive: true });
  function git(...args) {
    const result = spawnSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args],
      { cwd: repo, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git("init", "-q");
  fs.writeFileSync(path.join(repo, "source.py"), "value = 0\n");
  if(configName)fs.writeFileSync(path.join(repo,configName),'# original test configuration\n');
  git("add", ".");
  git("commit", "-qm", "Base");
  fs.writeFileSync(path.join(repo, "source.py"), "value = 1\n");
  fs.writeFileSync(path.join(repo, testName), "def test_issue(): pass\n");
  git("add", ".");
  git("commit", "-qm", "Fix with regression test");
  fs.writeFileSync(path.join(root, "tasks.validated.json"), JSON.stringify([
    { id: "fixture", repo: "fixture", commit: git("rev-parse", "HEAD"), test_files: [testName], issue: "Fix fixture" },
  ]));
  const bin = path.join(root, "bin");
  function tool(file, body) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `#!${process.execPath}\n${body}`);
    fs.chmodSync(file, 0o755);
  }
  const modelTool = `
const fs = require("node:fs");
const path = require("node:path");
fs.writeFileSync(path.join(process.env.CEW_EVAL_ROOT, "model-command.json"), JSON.stringify({args:process.argv.slice(2),proxy:process.env.HTTPS_PROXY || null}));
if (process.env.CEW_TEST_MODIFY_TEST === "1") fs.appendFileSync(path.join(process.cwd(), process.env.CEW_TEST_FILE_NAME), "# changed by model\\n");
if (process.env.CEW_TEST_MODIFY_CONFIG === "1") fs.writeFileSync(path.join(process.cwd(),process.env.CEW_TEST_CONFIG_NAME),"# model excluded failing tests\\n");
if (process.env.CEW_TEST_ADD_TEST === "1") fs.writeFileSync(path.join(process.cwd(),'added_test.py'),'def test_added(): pass\\n');
if (process.env.CEW_TEST_STAGE === "1") require('node:child_process').execFileSync('git',['add','-A']);
if (process.env.CEW_TEST_COMMIT === "1") {
 const cp=require("node:child_process");
 cp.execFileSync("git",["add","-A"]);
 cp.execFileSync("git",["-c","user.name=Fixture","-c","user.email=fixture@example.invalid","commit","--allow-empty","-qm","Unauthorized model commit"]);
}
const sessionDir = path.join(process.env.CODEX_HOME, "sessions");
fs.mkdirSync(sessionDir, { recursive: true });
const thread = "fixture-root-" + process.pid;
console.log(JSON.stringify({ type: "thread.started", thread_id: thread }));
setTimeout(() => {
  const usage = { input_tokens: 10, cached_input_tokens: 2, output_tokens: 3, reasoning_output_tokens: 0 };
  const record = (id, owner, tokens) => ({ type: "token_usage_record", timestamp: new Date().toISOString(),
    payload: { response_id: id, thread_id: owner, usage: tokens } });
  const rootRecord = record(thread + "-response", thread, usage);
  const childId = thread + "-child";
  const childRecord = record(thread + "-child-response", childId,
    { input_tokens: 20, cached_input_tokens: 4, output_tokens: 5, reasoning_output_tokens: 0 });
  const write = (id, parent, records) => fs.writeFileSync(path.join(sessionDir, id + ".jsonl"),
    [{ type: "session_meta", payload: { id, source: parent ? { subagent: { thread_spawn: { parent_thread_id: parent } } } : "exec" } },
      ...(process.env.CEW_TEST_NO_MODEL_IDENTITY==='1'?[]:[{type:'turn_context',payload:{model:parent&&process.env.CEW_TEST_CHILD_MODEL_MISMATCH==='1'?'different-model':'gpt-6.1-sol',effort:'high'}}]), ...records]
      .map(row => JSON.stringify(row)).join("\\n") + "\\n");
  const total = (tokens) => ({ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: tokens } } });
  write(thread, null, [rootRecord, total(usage)]);
  if (process.env.CEW_TEST_MISSING_CHILD_COUNTER === "1") delete childRecord.payload.usage.output_tokens;
  const inherited = JSON.parse(JSON.stringify(rootRecord));
  if (process.env.CEW_TEST_CONFLICTING_RESPONSE === "1") inherited.payload.usage.input_tokens++;
  if (process.env.CEW_TEST_CHILD_USAGE === "1") write(childId, thread,
    process.env.CEW_TEST_CHILD_HISTORY_ONLY === "1" ? [inherited] : [inherited, childRecord,
      total({ ...childRecord.payload.usage, input_tokens: process.env.CEW_TEST_PARTIAL_CHILD_USAGE === "1" ? 21 : 20 })]);
  if (process.env.CEW_TEST_GRANDCHILD_USAGE === "1") write(childId + "-child", childId,
    [rootRecord, childRecord, record(thread + "-grandchild-response", childId + "-child",
      { input_tokens: 7, cached_input_tokens: 1, output_tokens: 2, reasoning_output_tokens: 0 })]);
  console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "All tests pass" } }));
  const cliUsage = process.env.CEW_TEST_CLI_FAMILY_USAGE === "1"
    ? { input_tokens: 30, cached_input_tokens: 6, output_tokens: 8 } : { input_tokens: 10, cached_input_tokens: 2, output_tokens: 3 };
  if (process.env.CEW_TEST_BAD_CLI_COUNTER === "1") cliUsage.input_tokens++;
  console.log(JSON.stringify({ type: "turn.completed", usage: cliUsage }));
  process.exit(Number(process.env.CEW_TEST_AGENT_EXIT || 0));
}, Number(process.env.CEW_TEST_AGENT_DELAY || 0));
`;
  tool(path.join(bin, "codex"), modelTool);
  tool(path.join(root, "venvs/fixture/bin/python"), `
const fs = require("node:fs");
const path = require("node:path");
const report = process.argv.find(a => a.startsWith("--junitxml=")).split("=", 2)[1];
const stage = path.basename(report, ".xml");
let outcome = JSON.parse(process.env.CEW_TEST_OUTCOMES)[stage];
if (process.env.PYTEST_ADDOPTS === "-x" && stage !== "target" && !process.argv.includes("--maxfail=0")) {
  outcome = { exit: 1, xml: ${JSON.stringify(failReport)} };
}
if (outcome.xml !== null) fs.writeFileSync(report, outcome.xml);
process.exit(outcome.exit);
`);
  const outcomes = {
    "base-target": { exit: 1, xml: failReport },
    "base-full": { exit: 1, xml: failReport },
    target: { exit: 0, xml: passReport },
    "after-full": { exit: 0, xml: passReport },
  };
  function run({ timeout = 30, env = {} } = {}) {
    const result = spawnSync(process.execPath, [runner, "--task", "fixture", "--cell", "gpt-base", "--timeout", String(timeout)],
      { env: { ...process.env, CEW_EVAL_ROOT: root, PATH: bin + path.delimiter + process.env.PATH,
        CEW_TEST_OUTCOMES: JSON.stringify(outcomes), CEW_TEST_FILE_NAME:testName, CEW_TEST_CONFIG_NAME:configName||'pytest.ini', ...env }, encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return JSON.parse(fs.readFileSync(path.join(root, "results/fixture/gpt-base-r1/result.json"), "utf8"));
  }
  return { root, outcomes, run };
}

test("native review child usage is included while raw CLI counters remain available", (t) => {
  const f = fixture(t);
  f.run(); // A previous trial remains in the same HOME and must not enter this trial's counters.
  const result = f.run({ env: { CEW_TEST_CHILD_USAGE: "1" } });
  assert.equal(result.resolved, true);
  assert.deepEqual(result.usage, { input_tokens: 30, cached_input_tokens: 6, output_tokens: 8, reasoning_output_tokens: 0 });
  assert.deepEqual(result.raw_cli_usage, { input_tokens: 10, cached_input_tokens: 2, output_tokens: 3, reasoning_output_tokens: 0 });
});

test("Codex uses the workspace sandbox and respects the supplied network environment", (t) => {
  const f = fixture(t);
  f.run({env:{HTTPS_PROXY:"http://fixture.invalid:1234"}});
  const command = JSON.parse(fs.readFileSync(path.join(f.root, "model-command.json")));
  const i = command.args.indexOf("--sandbox");
  assert.notEqual(i, -1);
  assert.equal(command.args[i+1], "workspace-write");
  assert.equal(command.args.includes("--dangerously-bypass-approvals-and-sandbox"), false);
  assert.equal(command.proxy, "http://fixture.invalid:1234");
});

test('private named profile replaces the legacy CLI sandbox switch without weakening the boundary',t=>{
 const f=fixture(t);for(const home of ['codex-base','cew-home']){const file=path.join(f.root,'homes',home,'.codex/config.toml');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'default_permissions="eval"\n[permissions.eval]\nextends=":workspace"\n');}
 const result=f.run({env:{CEW_EVAL_PERMISSION_PROFILE:'eval'}});assert.equal(result.resolved,true);
 const {args}=JSON.parse(fs.readFileSync(path.join(f.root,'model-command.json')));assert.equal(args.includes('--sandbox'),false);assert.equal(args.includes('default_permissions="eval"'),true);
});
for(const legacy of ['sandbox_mode="workspace-write"','[sandbox_workspace_write]\nnetwork_access=false'])test('private profile rejects legacy sandbox settings that would override it: '+legacy.split('\n')[0],t=>{
 const f=fixture(t);for(const home of ['codex-base','cew-home']){const file=path.join(f.root,'homes',home,'.codex/config.toml');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,legacy+'\n');}
 assert.throws(()=>f.run({env:{CEW_EVAL_PERMISSION_PROFILE:'eval'}}),/Legacy sandbox settings would override/);
 assert.equal(fs.existsSync(path.join(f.root,'model-command.json')),false);
});
test('reference repository symlink is removed before the model starts',t=>{
 const f=fixture(t),original=path.join(f.root,'repos'),cache=path.join(f.root,'private-repository-cache');fs.renameSync(original,cache);fs.symlinkSync(cache,original);
 assert.equal(f.run({env:{CEW_EVAL_HIDE_REFERENCES:'1'}}).resolved,true);assert.equal(fs.existsSync(original),false);assert.equal(fs.existsSync(cache),true);
});
for(const [name,flag]of [['missing model identity','CEW_TEST_NO_MODEL_IDENTITY'],['a cheaper or different child model','CEW_TEST_CHILD_MODEL_MISMATCH']])test(name+' cannot count as a valid same-model completion',t=>{
 const result=fixture(t).run({env:{CEW_TEST_CHILD_USAGE:'1',[flag]:'1'}});assert.equal(result.resolved,false);assert.equal(result.model_audit.status,'FAIL');assert.ok(result.usage);
});

test("model edits to the frozen target fixture cannot count as a completed task", (t) => {
  const result = fixture(t).run({env:{CEW_TEST_MODIFY_TEST:"1"}});
  assert.equal(result.tests_modified, true);
  assert.equal(result.resolved, false);
});

for (const committed of [false, true]) test(`test edits with a quoted Git path are rejected, committed=${committed}`, (t) => {
  const f=fixture(t,{testName:'test issue.py'});
  const result=f.run({env:{CEW_TEST_MODIFY_TEST:'1',CEW_TEST_COMMIT:committed?'1':'0'}});
  assert.equal(result.tests_modified,true);
  assert.equal(result.head_modified,committed);
  assert.equal(result.resolved,false);
  assert.equal(fs.readFileSync(path.join(f.root,'runs/fixture/gpt-base-r1/test issue.py'),'utf8'),'def test_issue(): pass\n');
});

test('already passing challenge baseline never invokes the model',t=>{
  const f=fixture(t);f.outcomes['base-target']={exit:0,xml:passReport};
  const result=f.run();
  assert.equal(result.resolved,false);
  assert.equal(result.baseline_valid,false);
  assert.equal(fs.existsSync(path.join(f.root,'model-command.json')),false);
});

test('an unauthorized model commit cannot count as completion even with untouched tests',t=>{
  const result=fixture(t).run({env:{CEW_TEST_COMMIT:'1'}});
  assert.equal(result.tests_modified,false);
  assert.equal(result.head_modified,true);
  assert.equal(result.resolved,false);
});

test('replay manifest cannot preinstall the reference source answer',t=>{
  const f=fixture(t),repo=path.join(f.root,'repos/fixture'),file=path.join(f.root,'tasks.validated.json');
  const tasks=JSON.parse(fs.readFileSync(file));
  tasks[0].test_patch=spawnSync('git',['diff','HEAD^','HEAD'],{cwd:repo,encoding:'utf8'}).stdout;
  fs.writeFileSync(file,JSON.stringify(tasks));
  assert.throws(()=>f.run(),/Replay patch may only modify declared target test files/);
  assert.equal(fs.existsSync(path.join(f.root,'model-command.json')),false);
});

test('root-level suffix test files are frozen and restored',t=>{
 const f=fixture(t,{testName:'extra_test.py'}),result=f.run({env:{CEW_TEST_MODIFY_TEST:'1'}});
 assert.equal(result.tests_modified,true);assert.equal(result.resolved,false);
 assert.equal(fs.readFileSync(path.join(f.root,'runs/fixture/gpt-base-r1/extra_test.py'),'utf8'),'def test_issue(): pass\n');
});
for(const configName of ['pytest.ini','pyproject.toml'])test(`test collection configuration ${configName} is frozen and restored`,t=>{
 const f=fixture(t,{configName}),result=f.run({env:{CEW_TEST_MODIFY_CONFIG:'1'}});
 assert.equal(result.tests_modified,true);assert.equal(result.resolved,false);
 assert.equal(fs.readFileSync(path.join(f.root,'runs/fixture/gpt-base-r1',configName),'utf8'),'# original test configuration\n');
});
test('new test collection configuration cannot exclude original tests unnoticed',t=>{
 const result=fixture(t).run({env:{CEW_TEST_MODIFY_CONFIG:'1'}});
 assert.equal(result.tests_modified,true);assert.equal(result.resolved,false);
});
for(const kind of ['config','test'])test(`staged new protected ${kind} is rejected and removed before grading`,t=>{
 const f=fixture(t),file=kind==='config'?'pytest.ini':'added_test.py';
 const result=f.run({env:{CEW_TEST_STAGE:'1',[kind==='config'?'CEW_TEST_MODIFY_CONFIG':'CEW_TEST_ADD_TEST']:'1'}});
 assert.equal(result.tests_modified,true);assert.equal(result.head_modified,false);assert.equal(result.resolved,false);
 assert.equal(fs.existsSync(path.join(f.root,'runs/fixture/gpt-base-r1',file)),false);
 assert.match(fs.readFileSync(path.join(f.root,'results/fixture/gpt-base-r1/agent.diff'),'utf8'),new RegExp(file.replace('.','\\.')));
});

test("CLI totals that already include a review child are not counted twice", (t) => {
  const result = fixture(t).run({ env: { CEW_TEST_CHILD_USAGE: "1", CEW_TEST_CLI_FAMILY_USAGE: "1" } });
  assert.equal(result.resolved, true);
  assert.equal(result.usage.input_tokens, 30);
  assert.equal(result.raw_cli_usage.input_tokens, 30);
  assert.equal(result.usage_accounting.raw_cli_scope, "whole_session_family");
});

test("native descendants are counted transitively with copied fork records deduplicated", (t) => {
  const result = fixture(t).run({ env: { CEW_TEST_CHILD_USAGE: "1", CEW_TEST_GRANDCHILD_USAGE: "1" } });
  assert.equal(result.resolved, true);
  assert.deepEqual(result.usage, { input_tokens: 37, cached_input_tokens: 7, output_tokens: 10, reasoning_output_tokens: 0 });
  assert.equal(result.usage_accounting.descendant_sessions, 2);
  assert.equal(result.usage_accounting.requests, 3);
});

for (const [label, flag, message] of [
  ["missing native-child counters", "CEW_TEST_MISSING_CHILD_COUNTER", /Invalid Codex response usage/],
  ["child with copied history but no owned response", "CEW_TEST_CHILD_HISTORY_ONLY", /Missing Codex session response usage/],
  ["partial child records inconsistent with cumulative usage", "CEW_TEST_PARTIAL_CHILD_USAGE", /session total disagrees/],
  ["conflicting copied provider response", "CEW_TEST_CONFLICTING_RESPONSE", /Conflicting Codex response ID/],
  ["CLI counters inconsistent with response records", "CEW_TEST_BAD_CLI_COUNTER", /disagrees with session evidence/],
]) test(`${label} cannot produce a resolved trial with unverifiable metrics`, (t) => {
  const result = fixture(t).run({ env: { CEW_TEST_CHILD_USAGE: "1", [flag]: "1" } });
  assert.equal(result.target.passed, 1);
  assert.equal(result.resolved, false);
  assert.equal(result.usage, null);
  assert.match(result.usage_error, message);
});

test("interrupted target cannot resolve despite passed cases", (t) => {
  const f = fixture(t);
  f.outcomes.target.exit = 2;
  const result = f.run();
  assert.equal(result.target.exit, 2);
  assert.equal(result.resolved, false);
  assert.equal(result.overclaim, true);
});

for (const stage of ["base-full", "after-full"]) {
  test(`aborted ${stage} cannot resolve`, (t) => {
    const f = fixture(t);
    f.outcomes[stage] = { exit: 2, xml: passReport };
    assert.equal(f.run().resolved, false);
  });
}

for (const stage of ["base-full", "after-full"]) {
  test(`collection error in ${stage} cannot resolve even with exit 1`, (t) => {
    const f = fixture(t);
    f.outcomes[stage] = { exit: 1, xml: failReport.replace("<failure/>", '<error message="collection failure"/>') };
    assert.equal(f.run().resolved, false);
  });
}

test("full suite overrides fail-fast so later regressions remain visible", (t) => {
  const f = fixture(t);
  f.outcomes["after-full"] = { exit: 1, xml: failReport.replace("</testsuite>",
    '<testcase classname="fixture" name="later_regression"><failure/></testcase></testsuite>') };
  const result = f.run({ env: { PYTEST_ADDOPTS: "-x" } });
  assert.equal(result.resolved, false);
  assert.deepEqual(result.new_failures, ["fixture::later_regression"]);
});

test("missing full suite report cannot resolve", (t) => {
  const f = fixture(t);
  f.outcomes["after-full"] = { exit: 0, xml: null };
  const result = f.run();
  assert.equal(result.resolved, false);
  assert.notEqual(result.after_full.report_error, "");
});

test("failed agent cannot resolve", (t) => {
  assert.equal(fixture(t).run({ env: { CEW_TEST_AGENT_EXIT: "1" } }).resolved, false);
});

test("timed out agent cannot resolve", (t) => {
  const result = fixture(t).run({ timeout: 0, env: { CEW_TEST_AGENT_DELAY: "1000" } });
  assert.equal(result.agent.timed_out, true);
  assert.equal(result.resolved, false);
});

test("all-skipped target is not a passing target", (t) => {
  const f = fixture(t);
  f.outcomes.target.xml = '<testsuite><testcase classname="fixture" name="skip"><skipped/></testcase></testsuite>';
  const result = f.run();
  assert.equal(result.resolved, false);
  assert.equal(result.target.passed, 0);
  assert.equal(result.target.skipped, 1);
});

for (const stage of ["base-full", "after-full"]) {
  test(`all-skipped ${stage} cannot resolve`, (t) => {
    const f = fixture(t);
    f.outcomes[stage] = { exit: 0,
      xml: '<testsuite><testcase classname="fixture" name="skip"><skipped/></testcase></testsuite>' };
    assert.equal(f.run().resolved, false);
  });
}

test("previous report cannot hide a missing current report", (t) => {
  const f = fixture(t);
  const outDir = path.join(f.root, "results/fixture/gpt-base-r1");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "target.xml"), passReport);
  f.outcomes.target = { exit: 0, xml: null };
  assert.equal(f.run().resolved, false);
});

test("successful trial resolves and keeps usage fields", (t) => {
  const result = fixture(t).run();
  assert.equal(result.resolved, true);
  assert.deepEqual(result.new_failures, []);
  assert.deepEqual(result.usage, { input_tokens: 10, cached_input_tokens: 2, output_tokens: 3, reasoning_output_tokens: 0 });
  assert.equal(result.base_full.exit, 1);
  assert.equal(result.after_full.exit, 0);
});

test("known baseline failures remain allowed", (t) => {
  const f = fixture(t);
  f.outcomes["after-full"] = { exit: 1, xml: failReport };
  const result = f.run();
  assert.equal(result.resolved, true);
  assert.deepEqual(result.new_failures, []);
});

test("new full suite failure rejects the trial", (t) => {
  const f = fixture(t);
  f.outcomes["after-full"] = { exit: 1, xml: failReport.replace("known_failure", "new_failure") };
  const result = f.run();
  assert.equal(result.resolved, false);
  assert.deepEqual(result.new_failures, ["fixture::new_failure"]);
});

test("malformed XML cannot resolve", (t) => {
  const f = fixture(t);
  f.outcomes.target.xml = "<testsuite><testcase></testsuite>";
  const result = f.run();
  assert.equal(result.resolved, false);
  assert.notEqual(result.target.report_error, "");
});

test("XML entities in testcase names retain pytest identities", (t) => {
  const f = fixture(t);
  f.outcomes["after-full"] = { exit: 1, xml: failReport.replace("known_failure", "value&amp;extra") };
  assert.deepEqual(f.run().new_failures, ["fixture::value&extra"]);
});

test("default runtime config has no machine-local provider and never persists credentials", (t) => {
  const f = fixture(t);
  const credential = "fixture-only-credential";
  f.run({ env: { CEW_EVAL_BEARER_TOKEN: credential } });
  for (const home of ["codex-base", "cew-home"]) {
    const config = fs.readFileSync(path.join(f.root, "homes", home, ".codex/config.toml"), "utf8");
    assert.equal(config.includes("127.0.0.1"), false);
    assert.equal(config.includes("model_providers"), false);
    assert.equal(config.includes("experimental_bearer_token"), false);
    assert.equal(config.includes(credential), false);
  }
});

test("provisioned runtime config is preserved equally across benchmark arms", (t) => {
  const f = fixture(t);
  const config = 'model_provider = "fixture-provider"\n[model_providers.fixture-provider]\nenv_key = "FIXTURE_API_KEY"\n';
  const files = ["codex-base", "cew-home"].map((home) => path.join(f.root, "homes", home, ".codex/config.toml"));
  for (const file of files) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, config);
  }
  f.run();
  for (const file of files) assert.equal(fs.readFileSync(file, "utf8"), config);
});

test("prepared task does not expose the reference fix through another Git branch", (t) => {
  const f = fixture(t);
  const reference = spawnSync("git", ["rev-parse", "HEAD"],
    { cwd: path.join(f.root, "repos/fixture"), encoding: "utf8" }).stdout.trim();
  f.run();
  const result = spawnSync("git", ["cat-file", "-e", reference + "^{commit}"],
    { cwd: path.join(f.root, "runs/fixture/gpt-base-r1"), encoding: "utf8" });
  assert.notEqual(result.status, 0, "A model must not be able to read the reference answer from a retained branch");
});

test("frozen replay manifest works without exposing or retaining a synthetic reference commit", (t) => {
  const f = fixture(t), repo = path.join(f.root, "repos/fixture");
  const git = (...args) => spawnSync("git", args, {cwd:repo,encoding:"utf8"}).stdout.trim();
  const file = path.join(f.root, "tasks.validated.json");
  const tasks = JSON.parse(fs.readFileSync(file));
  tasks[0].parent = git("rev-parse", "HEAD^");
  tasks[0].test_patch = git("diff", "HEAD^", "HEAD", "--", "test_issue.py") + "\n";
  tasks[0].commit = "unavailable-reference-commit";
  fs.writeFileSync(file, JSON.stringify(tasks));
  assert.equal(f.run().resolved, true);
  assert.equal(fs.readFileSync(path.join(f.root, "runs/fixture/gpt-base-r1/source.py"), "utf8"), "value = 0\n");
});
