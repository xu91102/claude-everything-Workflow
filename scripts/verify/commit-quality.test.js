"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { run, diffPath, extractGitCommitInvocation } = require("../../hooks/commit-quality");

function git(repo, ...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
}

function initRepo(tempRoot, name) {
  const repo = path.join(tempRoot, name);
  fs.mkdirSync(repo, { recursive: true });
  git(repo, "init", "-q");
  git(repo, "config", "user.name", "Test");
  git(repo, "config", "user.email", "test@example.com");
  return repo;
}

function payload(command) {
  return JSON.stringify({ tool_input: { command } });
}

test("extractGitCommitInvocation matches git commit variants and ignores non-commit commands", () => {
  assert.ok(extractGitCommitInvocation('git commit -m "feat: ok"'));
  assert.equal(extractGitCommitInvocation('git commit -m "feat: ok"').message, "feat: ok");

  const withC = extractGitCommitInvocation("git -C /tmp/demo commit -m 'fix: bug'");
  assert.ok(withC);
  assert.deepEqual(withC.gitDirArgs, ["-C", "/tmp/demo"]);
  assert.equal(withC.message, "fix: bug");

  const chained = extractGitCommitInvocation('cd /tmp/demo && git -c user.name=Bot commit -m "bad msg"');
  assert.ok(chained);
  assert.equal(chained.cdDir, "/tmp/demo");
  assert.equal(chained.message, "bad msg");

  const subshellCd = extractGitCommitInvocation('(cd /tmp/sub) && git commit -m "feat: ok"', "/tmp/root");
  assert.ok(subshellCd);
  assert.equal(subshellCd.cdDir, null, "subshell cd must not leak to subsequent git commit");

  const withGitDir = extractGitCommitInvocation("git --git-dir=/tmp/r/.git --work-tree=/tmp/r commit -m 'fix: wt'");
  assert.ok(withGitDir);
  assert.deepEqual(withGitDir.gitDirArgs, ["--git-dir=/tmp/r/.git", "--work-tree=/tmp/r"]);

  assert.ok(extractGitCommitInvocation('npm test; git commit -m "chore: update"'));
  assert.equal(extractGitCommitInvocation("git status"), null);
  assert.equal(extractGitCommitInvocation('echo "git commit"'), null);
  assert.equal(extractGitCommitInvocation('git log --grep="git commit"'), null);
});

test("diffPath decodes Git quoted UTF-8 paths and strips b/ prefix", () => {
  assert.equal(diffPath("b/src/app.js"), "src/app.js");
  assert.equal(diffPath('"b/src/\\344\\270\\255\\346\\226\\207 file.js"'), "src/中文 file.js");
});

test("multi-file staged diff attributes secret and debug lines to the exact first file without echoing secrets", (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cq-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const repo = initRepo(tempRoot, "multi-file");
  const secretValue = "skTest0123456789abcdef012345";
  fs.writeFileSync(
    path.join(repo, "a-secret.js"),
    `const apiKey = "${secretValue}";\nconsole.log(apiKey);\n`,
  );
  fs.writeFileSync(path.join(repo, "z-clean.js"), "export const ok = 1;\n");
  git(repo, "add", "a-secret.js", "z-clean.js");

  const result = run(payload('git commit -m "feat: add files"'), { cwd: repo });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /检测到疑似密钥: a-secret\.js:1/);
  assert.match(result.stderr, /检测到调试代码: a-secret\.js:2/);
  assert.doesNotMatch(result.stderr, /z-clean\.js/);
  assert.equal(result.stderr.includes(secretValue), false, "must never echo secret value");
});

test("same-line secret and console.log blocks and never leaks secret text", (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cq-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const repo = initRepo(tempRoot, "same-line");
  const secretValue = "super_secret_token_value_12345";
  fs.writeFileSync(
    path.join(repo, "leak.js"),
    `console.log({ token: "${secretValue}" });\n`,
  );
  git(repo, "add", "leak.js");

  const result = run(payload('git commit -m "fix: leak check"'), { cwd: repo });
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /检测到疑似密钥: leak\.js:1/);
  assert.match(result.stderr, /检测到调试代码: leak\.js:1/);
  assert.equal(result.stderr.includes(secretValue), false);
});

test("multi-hunk diff attributes second hunk to exact new-file line number", (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cq-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const repo = initRepo(tempRoot, "multi-hunk");
  const baseLines = Array.from({ length: 20 }, (_, i) => `const line${i + 1} = ${i + 1};`);
  fs.writeFileSync(path.join(repo, "app.js"), baseLines.join("\n") + "\n");
  git(repo, "add", "app.js");
  git(repo, "commit", "-q", "-m", "chore: initial");

  const updatedLines = [...baseLines];
  updatedLines[1] = "const line2 = 200;";
  updatedLines[17] = "console.log('hunk2');";
  fs.writeFileSync(path.join(repo, "app.js"), updatedLines.join("\n") + "\n");
  git(repo, "add", "app.js");

  const result = run(payload('git commit -m "fix: update app"'), { cwd: repo });
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /检测到调试代码: app\.js:18\b/);
});

test("UTF-8, spaces, deleted files, and git -C commits are handled accurately", (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cq-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const repo = initRepo(tempRoot, "utf8-del");
  fs.writeFileSync(path.join(repo, "removed.js"), "console.log('old');\n");
  git(repo, "add", "removed.js");
  git(repo, "commit", "-q", "-m", "chore: seed");

  git(repo, "rm", "-q", "removed.js");
  fs.writeFileSync(path.join(repo, "中文 file.js"), "debugger;\n");
  git(repo, "add", "中文 file.js");

  // Invoke from outside repo using git -C <repo>
  const result = run(payload(`git -C "${repo}" commit -m "feat: utf8"`), { cwd: tempRoot });
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /检测到调试代码: 中文 file\.js:1/);
  assert.doesNotMatch(result.stderr, /removed\.js/);

  // Invoke from outside repo using chained cd <repo> && git commit
  const cdResult = run(payload(`cd "${repo}" && git commit -m "feat: cd"`), { cwd: tempRoot });
  assert.equal(cdResult.exitCode, 0);
  assert.match(cdResult.stderr, /检测到调试代码: 中文 file\.js:1/);
  assert.doesNotMatch(cdResult.stderr, /无法检查暂存区/);

  // Unresolvable cd before git commit warns instead of scanning wrong cwd
  const unresolvedResult = run(payload('cd "$TARGET_REPO" && git commit -m "feat: var"'), { cwd: repo });
  assert.equal(unresolvedResult.exitCode, 0);
  assert.match(unresolvedResult.stderr, /无法检查暂存区/);
});

test("non-git directory reports warning instead of silently skipping, and invalid commit message warns", (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cq-nongit-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const result = run(payload('git commit -m "bad message"'), { cwd: tempRoot });
  assert.equal(result.exitCode, 0);
  assert.match(result.stderr, /Commit message 格式不符合规范/);
  assert.match(result.stderr, /无法检查暂存区/);
});

test("subshells inherit and restore their working directories independently", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cq-groups-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outer = initRepo(root, "outer");
  const inner = initRepo(outer, "inner");
  fs.writeFileSync(path.join(inner, "inner.js"), "debugger;\n");
  git(inner, "add", "inner.js");
  assert.match(run(payload("(cd inner && (git commit -m 'test: nested'))"), { cwd: outer }).stderr, /inner\.js:1/);
  assert.equal(run(payload("(cd inner); (git commit -m 'test: sibling')"), { cwd: outer }).stderr, undefined);
  const multiple = run(payload("git commit -m 'test: outer'; (cd inner && git commit -m 'test: inner')"), { cwd: outer });
  assert.match(multiple.stderr, /inner\.js:1/);
});

test("pipeline stages and background command lists keep their own working directories", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cq-processes-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outer = initRepo(root, "outer");
  const inner = initRepo(outer, "inner");
  for (const [dir, file] of [[outer, "outer.js"], [inner, "inner.js"]]) {
    fs.writeFileSync(path.join(dir, file), "debugger;\n");
    git(dir, "add", file);
  }
  const commit = "git commit -m 'test: context'";
  for (const prefix of ["cd inner | cat;", "cat | cd inner;", "cat |&\n cd inner;",
    "cd inner & wait;", "cd inner && true &", "cd inner |", "(cd inner) | cat;"]) {
    const result = run(payload(prefix + " " + commit), { cwd: outer });
    assert.match(result.stderr, /outer\.js:1/, prefix);
    assert.doesNotMatch(result.stderr, /inner\.js:1/, prefix);
  }
  for (const command of ["cd inner 2>&1; " + commit, "cd inner && " + commit + " &",
    "cd inner; cat | cd ..; " + commit]) {
    assert.match(run(payload(command), { cwd: outer }).stderr, /inner\.js:1/, command);
  }
  const both = run(payload("cd inner &&\n " + commit + " & " + commit), { cwd: outer });
  assert.match(both.stderr, /inner\.js:1/);
  assert.match(both.stderr, /outer\.js:1/);
});

test("brace groups share directory changes with their caller, including inside a pipeline", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cq-braces-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outer = initRepo(root, "outer");
  const inner = initRepo(outer, "inner");
  fs.writeFileSync(path.join(inner, "inner.js"), "debugger;\n");
  git(inner, "add", "inner.js");
  const commit = "git commit -m 'test: current'";
  for (const cmd of ["{ cd inner; " + commit + "; }", "{ { cd inner; }; }; " + commit]) {
    assert.match(run(payload(cmd), { cwd: outer }).stderr, /inner\.js:1/, cmd);
  }
  assert.equal(run(payload("{ cd inner; } | cat; " + commit), { cwd: outer }).stderr, undefined);
});

test("shell function definitions run at their call site and unused bodies are skipped", () => {
  assert.equal(extractGitCommitInvocation("save() {\n git commit -m ignored;\n}\nprintf done"), null);
  assert.equal(extractGitCommitInvocation("printf '%s' 'save() { git commit; }'"), null);
  assert.match(run(payload("again() { again; }; again")).stderr, /静态分析范围/);
  const body = "{ { git commit -m 'test: called'; }; }";
  for (const definition of ["save() " + body, "function save " + body, "save () ( git commit -m 'test: called' )"]) {
    assert.equal(extractGitCommitInvocation(definition + "\nprintf 'done'"), null);
    assert.equal(extractGitCommitInvocation(definition + "\ngit commit -m 'test: direct'").message, "test: direct");
    const called = extractGitCommitInvocation(definition + "\n(cd nested && save)", "/root");
    assert.equal(called.cdDir, path.resolve("/root", "nested"));
    assert.equal(called.message, "test: called");
  }
});

test("here-document input is data, including tab-stripped and quoted terminators", () => {
  const doc = "cat <<'FIRST' <<-SECOND\ngit commit -m example\nFIRST\n\tgit commit -m other\n\tSECOND";
  assert.equal(extractGitCommitInvocation(doc), null);
  assert.equal(extractGitCommitInvocation("echo $((1 << 2))\ngit commit -m arithmetic").message, "arithmetic");
  assert.equal(extractGitCommitInvocation(doc + "\ngit commit -m 'docs: real'").message, "docs: real");
  assert.equal(extractGitCommitInvocation('echo "cat <<EOF"; git commit -m "docs: quoted"').message, "docs: quoted");
  assert.equal(extractGitCommitInvocation('cat <<< word; git commit -m "docs: string"').message, "docs: string");
});

test("Git directory and index settings select the actual staged files", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cq-env-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outer = initRepo(root, "outer");
  const inner = initRepo(root, "inner repo");
  const alternate = path.join(inner, "alternate.index");
  fs.writeFileSync(path.join(inner, "alternate.js"), "debugger;\n");
  execFileSync("git", ["add", "alternate.js"], { cwd: inner, env: { ...process.env, GIT_INDEX_FILE: alternate } });
  const prefix = "env GIT_DIR='../inner repo/.git' GIT_WORK_TREE='../inner repo' GIT_INDEX_FILE='../inner repo/alternate.index'";
  assert.match(run(payload(prefix + " git commit -m 'test: index'"), { cwd: outer }).stderr, /alternate\.js:1/);
  const commit = "git commit -m 'test: exported index'";
  const exported = prefix.replace(/^env /, "export ");
  for (const command of [exported + "; " + commit, "{ " + exported + "; }; " + commit,
    prefix.slice(4) + "; export GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE; " + commit]) {
    assert.match(run(payload(command), { cwd: outer }).stderr, /alternate\.js:1/, command);
  }
  for (const command of ["(" + exported + "); " + commit, exported + " | cat; " + commit,
    exported + "; unset GIT_INDEX_FILE; " + commit, exported + "; export -n GIT_INDEX_FILE; " + commit]) {
    assert.equal(run(payload(command), { cwd: outer }).stderr, undefined, command);
  }
  assert.match(run(payload("export GIT_INDEX_FILE=$LATER; " + commit), { cwd: outer }).stderr, /无法检查暂存区/);

  assert.match(run(payload('GIT_INDEX_FILE="$OTHER_INDEX" git commit -m "test: dynamic"'), { cwd: outer }).stderr, /无法检查暂存区/);
});

test("both Claude installation modes register one edit check and honor individual switches", (t) => {
  const root = path.resolve(__dirname, "../..");
  for (const config of ["settings.json", ".claude-plugin/hooks.json"]) {
    const hooks = JSON.parse(fs.readFileSync(path.join(root, config))).hooks.PostToolUse;
    const edit = hooks.filter(g => g.matcher === "Edit|Write|MultiEdit").flatMap(g => g.hooks);
    assert.equal(edit.length, 1, config);
    assert.match(edit[0].command, /hooks\/check-edited-file\.js/);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cew-edits-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "demo.ts");
  fs.writeFileSync(file, "// @ts-ignore\n" + "a".repeat(121));
  const stdin = JSON.stringify({ tool_input: { file_path: file } });
  const runEdit = (disabled) => {
    const result = require("node:child_process").spawnSync(process.execPath, [path.join(root, "hooks/check-edited-file.js")], {
      input: stdin, encoding: "utf8", env: { ...process.env, ECC_HOOK_PROFILE: "standard", ECC_DISABLED_HOOKS: disabled },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stderr;
  };
  const all = runEdit("");
  assert.match(all, /@ts-ignore/);
  assert.match(all, /120/);
  assert.doesNotMatch(runEdit("post:edit:console-log"), /@ts-ignore/);
  assert.doesNotMatch(runEdit("post:edit:code-size"), /120/);
  assert.equal(runEdit("post:edit:console-log,post:edit:code-size"), "");
});
