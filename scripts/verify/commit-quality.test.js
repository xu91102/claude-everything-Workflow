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

test(
  "multi-file staged diff attributes secret and debug lines to the exact first file without echoing secrets",
  (t) => {
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
  execFileSync("git", ["add", "alternate.js"], {
    cwd: inner,
    env: { ...process.env, GIT_INDEX_FILE: alternate },
  });
  const prefix =
    "env GIT_DIR='../inner repo/.git' GIT_WORK_TREE='../inner repo'" +
    " GIT_INDEX_FILE='../inner repo/alternate.index'";
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

  assert.match(
    run(payload('GIT_INDEX_FILE="$OTHER_INDEX" git commit -m "test: dynamic"'), { cwd: outer }).stderr,
    /无法检查暂存区/,
  );
});

test("command substitution, nested subshells, heredoc messages, wrappers, and Windows paths", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cq-edge-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = initRepo(root, "repo");
  const inner = initRepo(repo, "inner");
  const secret = "skTest0123456789abcdef012345";
  fs.writeFileSync(path.join(inner, "s.js"), `const apiKey = "${secret}";\n`);
  git(inner, "add", "s.js");

  // $(...) in -C / GIT_DIR must warn explicitly rather than silently skipping or scanning wrong dir.
  const subArg = run(payload('git -C $(pwd)/inner commit -m "feat: sub"'), { cwd: repo });
  assert.match(subArg.stderr, /无法检查暂存区/);
  const dynEnv = run(payload('GIT_DIR=$(git rev-parse --git-dir) git commit -m "feat: dyn"'), { cwd: inner });
  assert.match(dynEnv.stderr, /无法检查暂存区/);

  // $(...) in non-path option (-c) still runs and catches staged secret.
  const cfgSub = run(payload('git -c user.name=$(whoami) commit -m "feat: c"'), { cwd: inner });
  assert.equal(cfgSub.exitCode, 2);
  assert.match(cfgSub.stderr, /s\.js:1/);

  // Bare nested subshells ((cd inner); git commit) must not be dropped as arithmetic.
  const nested = run(payload('((cd inner); git commit -m "feat: nested")'), { cwd: repo });
  assert.equal(nested.exitCode, 0);
  const nestedIn = run(payload('(cd inner && (git commit -m "feat: in"))'), { cwd: repo });
  assert.equal(nestedIn.exitCode, 2);

  // Claude Code heredoc commit with internal quotes and semicolons: no false format warning or split.
  const heredocCmd = 'git commit -m "$(cat <<\'EOF\'\nfix: handle "foo; cd /tmp"\nEOF\n)"';
  const heredocRes = run(payload(heredocCmd), { cwd: repo });
  assert.equal(heredocRes.exitCode, 0);
  assert.equal(heredocRes.stderr, undefined);

  // cd -P, control keywords, wrappers, and ~ path warning.
  const cdFlag = run(payload('cd -P inner && git commit -m "feat: flag"'), { cwd: repo });
  assert.equal(cdFlag.exitCode, 2);
  const ifWrap = run(payload('if true; then command git -C inner commit -m "feat: if"; fi'), { cwd: repo });
  assert.equal(ifWrap.exitCode, 2);
  const tildeWarn = run(payload('git -C ~/repo commit -m "feat: tilde"'), { cwd: repo });
  assert.match(tildeWarn.stderr, /无法检查暂存区/);

  // git add && git commit emits pre-staging notice.
  const addCommit = run(payload('git add clean.js && git commit -m "feat: staged"'), { cwd: repo });
  assert.match(addCommit.stderr, /仅检查执行前的已暂存区/);

  // Windows paths and git.exe recognition.
  const winCd = extractGitCommitInvocation('cd C:\\Users\\dev\\repo && git commit -m "feat: win"', "/tmp/base");
  assert.equal(winCd.cdDir, "C:\\Users\\dev\\repo");
  const winC = extractGitCommitInvocation('git -C C:\\Users\\dev\\repo commit -m "feat: winc"');
  assert.deepEqual(winC.gitDirArgs, ["-C", "C:\\Users\\dev\\repo"]);
  const winExe = extractGitCommitInvocation('"C:\\Program Files\\Git\\cmd\\git.exe" commit -m "feat: exe"');
  assert.ok(winExe);
  assert.equal(winExe.message, "feat: exe");

  // Non-git and invalid -C errors preserve stderr reason rather than truncated command line.
  const nonGit = run(payload('git commit -m "feat: nongit"'), { cwd: root });
  assert.match(nonGit.stderr, /unknown option.*cached|not a git repository/i);
  assert.doesNotMatch(nonGit.stderr, /Command failed:/);
  const badDir = run(payload('git -C ./no-such-dir commit -m "feat: bad"'), { cwd: root });
  assert.match(badDir.stderr, /cannot change to|No such file/i);

  // env -i clears inherited GIT_* env vars, and identical sequential commits emit scan warnings once.
  const origGitDir = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(root, "nonexistent.git");
  try {
    const envCleared = run(payload('env -i git commit -m "feat: env-clear"'), { cwd: inner });
    assert.equal(envCleared.exitCode, 2);
    assert.match(envCleared.stderr, /s\.js:1/);
  } finally {
    if (origGitDir === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = origGitDir;
  }

  const dup = run(payload('git commit -m "feat: one" && git commit -m "feat: two"'), { cwd: inner });
  assert.equal(dup.exitCode, 2);
  assert.equal(dup.stderr.match(/s\.js:1/g)?.length, 1);

  // env -u / -i applies in order and conditional branches do not assume cd/export took effect.
  const unsetEnv = run(
    payload("GIT_DIR=inner/.git GIT_WORK_TREE=inner env -u GIT_DIR -u GIT_WORK_TREE git commit -m 'feat: outer'"),
    { cwd: repo },
  );
  assert.equal(unsetEnv.exitCode, 0);
  assert.equal(unsetEnv.stderr, undefined);

  const clearedPrefix = run(payload("GIT_DIR=inner/.git env -i git commit -m 'feat: outer'"), { cwd: repo });
  assert.equal(clearedPrefix.exitCode, 0);
  assert.equal(clearedPrefix.stderr, undefined);

  for (const condCmd of [
    "if false; then cd inner; fi; git commit -m 'feat: outer'",
    "false && cd inner; git commit -m 'feat: outer'",
    "true || cd inner; git commit -m 'feat: outer'",
    "if false; then export GIT_DIR=inner/.git GIT_WORK_TREE=inner; fi; git commit -m 'feat: outer'",
  ]) {
    const condRes = run(payload(condCmd), { cwd: repo });
    assert.equal(condRes.exitCode, 0, condCmd);
    assert.match(condRes.stderr, /无法检查暂存区/, condCmd);
  }

  const inBranch = run(payload("if true; then cd inner && git commit -m 'feat: in'; fi"), { cwd: repo });
  assert.equal(inBranch.exitCode, 2);
  assert.match(inBranch.stderr, /s\.js:1/);

  const elseBranch = run(payload("if false; then cd inner; else git commit -m 'feat: else'; fi"), { cwd: repo });
  assert.equal(elseBranch.exitCode, 0);
  assert.equal(elseBranch.stderr, undefined);

  // command suppresses function lookup; array assignments are data; cd -P resolves physical symlinks.
  const bypassCmd = "git() { /usr/bin/git commit -m 'test: helper'; }; command git status --short";
  const bypassRes = run(payload(bypassCmd), { cwd: inner });
  assert.equal(bypassRes.exitCode, 0);
  assert.equal(bypassRes.stderr, undefined);

  const cmdV = run(payload("command -v git commit -m 'test: v'"), { cwd: inner });
  assert.equal(cmdV.exitCode, 0);
  assert.equal(cmdV.stderr, undefined);

  for (const arrCmd of [
    "args=(git commit -m 'test: example'); printf '%s\\n' \"${args[@]}\"",
    "args=( git commit -m 'test: spaced' )",
  ]) {
    const arrRes = run(payload(arrCmd), { cwd: inner });
    assert.equal(arrRes.exitCode, 0, arrCmd);
    assert.equal(arrRes.stderr, undefined, arrCmd);
  }

  const physOuter = initRepo(root, "phys-outer");
  fs.writeFileSync(path.join(physOuter, "secret.js"), `const apiKey = "${secret}";\n`);
  git(physOuter, "add", "secret.js");
  const physInner = initRepo(root, "phys-inner");
  const physChild = path.join(physInner, "child");
  fs.mkdirSync(physChild, { recursive: true });
  fs.symlinkSync(physChild, path.join(physOuter, "link"), process.platform === "win32" ? "junction" : "dir");
  const physRes = run(payload("cd -P link/.. && git commit -m 'test: physical'"), { cwd: physOuter });
  assert.equal(physRes.exitCode, 0);
  assert.equal(physRes.stderr, undefined);

  const badPhys = run(payload("cd -P nonexistent/.. && git commit -m 'feat: bad-phys'"), { cwd: root });
  assert.equal(badPhys.exitCode, 0);
  assert.match(badPhys.stderr, /无法检查暂存区/);
});
