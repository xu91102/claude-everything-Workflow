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
