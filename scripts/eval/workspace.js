"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { EvalError, safeRelativePath } = require("./schema");

const GIT_METADATA = Symbol("git-metadata");
const SNAPSHOT_LIMITS = Object.freeze({
  maxEntries: 4096,
  maxDepth: 64,
  maxFileBytes: 1024 * 1024,
});

function snapshotLimit(kind, limit) {
  return new EvalError(
    "E_SNAPSHOT_LIMIT",
    `workspace snapshot ${kind} limit exceeded (${limit})`,
    3,
  );
}

function isInsideRoot(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function captureRootIdentity({ tempRoot, workspace }) {
  const entry = fs.lstatSync(workspace);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new EvalError("E_PATH_BOUNDARY", "fixture root must be a real directory", 3);
  }
  const real = fs.realpathSync(workspace);
  const stat = fs.statSync(real);
  return { tempRoot, workspace, real, dev: stat.dev, ino: stat.ino };
}

function assertRootIdentity(identity) {
  let entry;
  try {
    entry = fs.lstatSync(identity.workspace);
  } catch (error) {
    throw new EvalError("E_PATH_BOUNDARY", "fixture root is missing", 3, {
      cause: error.code,
    });
  }
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new EvalError("E_PATH_BOUNDARY", "fixture root identity changed", 3);
  }
  const real = fs.realpathSync(identity.workspace);
  const stat = fs.statSync(real);
  if (real !== identity.real || stat.dev !== identity.dev || stat.ino !== identity.ino) {
    throw new EvalError("E_PATH_BOUNDARY", "fixture root identity changed", 3);
  }
}

function resolveWorkspacePath(identity, relative) {
  assertRootIdentity(identity);
  const safe = safeRelativePath(relative);
  const candidate = path.resolve(identity.workspace, ...safe.split("/"));
  if (!isInsideRoot(identity.workspace, candidate)) {
    throw new EvalError("E_PATH_BOUNDARY", `path escapes fixture root: ${relative}`, 3);
  }

  let current = identity.workspace;
  for (const segment of safe.split("/")) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw new EvalError("E_FIXTURE", `cannot inspect ${relative}`, 3, {
        cause: error.code,
      });
    }
    if (!stat.isSymbolicLink()) continue;
    let real;
    try {
      real = fs.realpathSync(current);
    } catch {
      throw new EvalError("E_PATH_BOUNDARY", `broken symlink in path: ${relative}`, 3);
    }
    if (!isInsideRoot(identity.real, real)) {
      throw new EvalError("E_PATH_BOUNDARY", `symlink escapes fixture root: ${relative}`, 3);
    }
  }
  return candidate;
}

function writeWorkspaceFile(identity, relative, content) {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > SNAPSHOT_LIMITS.maxFileBytes) {
    throw snapshotLimit("file bytes", SNAPSHOT_LIMITS.maxFileBytes);
  }
  const target = resolveWorkspacePath(identity, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function applyWorkspaceSnapshot(identity, snapshot) {
  for (const [relative, content] of Object.entries(snapshot || {})) {
    const target = resolveWorkspacePath(identity, relative);
    if (content === null) {
      fs.rmSync(target, { force: true });
    } else {
      writeWorkspaceFile(identity, relative, content);
    }
  }
}

function trustedGitCandidates() {
  if (process.platform !== "win32") {
    return ["/usr/bin/git", "/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"];
  }
  const drive = path.parse(process.execPath).root || "C:\\";
  return [
    path.join(drive, "Program Files", "Git", "cmd", "git.exe"),
    path.join(drive, "Program Files", "Git", "bin", "git.exe"),
    path.join(drive, "Program Files (x86)", "Git", "cmd", "git.exe"),
  ];
}

function resolveTrustedGit() {
  for (const candidate of trustedGitCandidates()) {
    try {
      const real = fs.realpathSync(candidate);
      if (path.isAbsolute(real) && fs.statSync(real).isFile()) return real;
    } catch {
      // 固定候选不可用时继续检查下一个系统安装路径。
    }
  }
  throw new EvalError("E_FIXTURE", "trusted Git executable was not found", 3);
}

function cleanGitEnvironment(gitExecutable) {
  const env = {
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: os.devNull,
    GIT_TERMINAL_PROMPT: "0",
    LANG: "C",
    LC_ALL: "C",
    PATH: path.dirname(gitExecutable),
  };
  if (process.platform === "win32") {
    const systemRoot = path.parse(process.execPath).root;
    env.SystemRoot = path.join(systemRoot, "Windows");
    env.ComSpec = path.join(env.SystemRoot, "System32", "cmd.exe");
  }
  return env;
}

function runGit(identity, args) {
  assertRootIdentity(identity);
  const gitExecutable = resolveTrustedGit();
  const safeArgs = [
    "-c",
    "commit.gpgSign=false",
    "-c",
    "tag.gpgSign=false",
    "-c",
    "core.hooksPath=.git/cew-disabled-hooks",
    ...args,
  ];
  const result = spawnSync(gitExecutable, safeArgs, {
    cwd: identity.workspace,
    encoding: "utf8",
    env: cleanGitEnvironment(gitExecutable),
    shell: false,
  });
  if (result.status !== 0 || result.error) {
    throw new EvalError("E_FIXTURE", `git ${args[0]} failed`, 3, {
      cause: result.error?.code,
      status: result.status,
    });
  }
  return result.stdout;
}

function portableMode(stat) {
  return process.platform === "win32" ? null : stat.mode & 0o777;
}

function fileDescriptor(target, stat) {
  if (stat.isSymbolicLink()) {
    return { type: "symlink", target: fs.readlinkSync(target) };
  }
  if (!stat.isFile()) return { type: "special", mode: portableMode(stat) };
  if (stat.size > SNAPSHOT_LIMITS.maxFileBytes) {
    throw snapshotLimit("file bytes", SNAPSHOT_LIMITS.maxFileBytes);
  }
  const content = fs.readFileSync(target);
  return {
    type: "file",
    mode: portableMode(stat),
    size: content.length,
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
  };
}

function consumeSnapshotEntry(budget) {
  budget.entries += 1;
  if (budget.entries > SNAPSHOT_LIMITS.maxEntries) {
    throw snapshotLimit("entries", SNAPSHOT_LIMITS.maxEntries);
  }
}

function boundedEntries(directory, budget) {
  const handle = fs.opendirSync(directory);
  const entries = [];
  try {
    let entry = handle.readSync();
    while (entry !== null) {
      consumeSnapshotEntry(budget);
      entries.push(entry);
      entry = handle.readSync();
    }
  } finally {
    handle.closeSync();
  }
  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

function visitTree(options) {
  const { directory, prefix, snapshot, skipRootGit, skipRootIndex } = options;
  const { budget, depth = 0 } = options;
  let sawExactGit = false;
  for (const entry of boundedEntries(directory, budget)) {
    if (!prefix && skipRootGit && entry.name === ".git") {
      sawExactGit = true;
      continue;
    }
    if (!prefix && skipRootIndex && entry.name === "index") continue;
    const entryDepth = depth + 1;
    if (entryDepth > SNAPSHOT_LIMITS.maxDepth) {
      throw snapshotLimit("depth", SNAPSHOT_LIMITS.maxDepth);
    }
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const target = path.join(directory, entry.name);
    const stat = fs.lstatSync(target);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      snapshot[relative] = { type: "directory", mode: portableMode(stat) };
      visitTree({
        directory: target,
        prefix: relative,
        snapshot,
        budget,
        depth: entryDepth,
      });
    } else {
      snapshot[relative] = fileDescriptor(target, stat);
    }
  }
  return sawExactGit;
}

function semanticGitIndex(identity) {
  try {
    const staged = runGit(identity, ["ls-files", "--stage", "-z"]);
    const flags = runGit(identity, ["ls-files", "-v", "-z"]);
    return {
      type: "semantic-index",
      sha256: crypto
        .createHash("sha256")
        .update(staged)
        .update("\0")
        .update(flags)
        .digest("hex"),
    };
  } catch (error) {
    return { type: "git-error", code: error.code || "E_FIXTURE" };
  }
}

function snapshotGitMetadata(identity, budget, hasExactGit) {
  if (!hasExactGit) return null;
  const gitDirectory = path.join(identity.workspace, ".git");
  const stat = fs.lstatSync(gitDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    return { root: fileDescriptor(gitDirectory, stat) };
  }
  const snapshot = Object.create(null);
  visitTree({
    directory: gitDirectory,
    prefix: "",
    snapshot,
    budget,
    skipRootIndex: true,
  });
  if (identity.gitRepository) snapshot.index = semanticGitIndex(identity);
  return snapshot;
}

function snapshotTree(identity) {
  assertRootIdentity(identity);
  const snapshot = Object.create(null);
  const budget = { entries: 0 };
  const hasExactGit = visitTree({
    directory: identity.workspace,
    prefix: "",
    snapshot,
    budget,
    skipRootGit: true,
  });
  snapshot[GIT_METADATA] = snapshotGitMetadata(identity, budget, hasExactGit);
  return snapshot;
}

function unexpectedWorkspaceChanges(before, after, allowedPaths) {
  const allowed = new Set(allowedPaths.map(safeRelativePath));
  const allowedParents = expectedParentDirectories(allowed);
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  const unexpected = [];
  for (const relative of [...paths].sort()) {
    if (allowed.has(relative)) {
      const previous = before[relative];
      const current = after[relative];
      if (
        previous &&
        current &&
        (previous.type !== current.type || previous.mode !== current.mode)
      ) {
        unexpected.push(relative);
      }
      continue;
    }
    const parentDescriptors = [before[relative], after[relative]].filter(Boolean);
    if (
      allowedParents.has(relative) &&
      parentDescriptors.every((descriptor) => descriptor.type === "directory") &&
      (parentDescriptors.length < 2 || before[relative].mode === after[relative].mode)
    ) {
      continue;
    }
    if (JSON.stringify(before[relative]) !== JSON.stringify(after[relative])) {
      unexpected.push(relative);
    }
  }
  if (JSON.stringify(before[GIT_METADATA]) !== JSON.stringify(after[GIT_METADATA])) {
    unexpected.push(".git");
  }
  return unexpected;
}

function expectedParentDirectories(allowed) {
  const parents = new Set();
  for (const relative of allowed) {
    const segments = relative.split("/");
    segments.pop();
    while (segments.length > 0) {
      parents.add(segments.join("/"));
      segments.pop();
    }
  }
  return parents;
}

async function createFixture({ scenario, tempBase = os.tmpdir() }) {
  let tempRoot;
  try {
    tempRoot = fs.mkdtempSync(path.join(tempBase, "cew eval 空格-"));
    const workspace = path.join(tempRoot, "工作区 space");
    fs.mkdirSync(workspace);
    const identity = captureRootIdentity({ tempRoot, workspace });
    for (const [relative, content] of Object.entries(scenario.fixture.files || {})) {
      writeWorkspaceFile(identity, relative, content);
    }
    await initializeGitFixture(identity, scenario.fixture.git);
    const baseline = snapshotTree(identity);
    return buildFixture({ scenario, identity, baseline });
  } catch (error) {
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
    if (error instanceof EvalError) throw error;
    throw new EvalError("E_FIXTURE", `cannot create fixture ${scenario.id}`, 3, {
      cause: error.code,
    });
  }
}

async function initializeGitFixture(identity, gitFixture) {
  if (!gitFixture) return;
  for (const [relative, content] of Object.entries(gitFixture.committedFiles)) {
    writeWorkspaceFile(identity, relative, content);
  }
  runGit(identity, ["init", "--quiet", "--template="]);
  runGit(identity, ["add", "."]);
  runGit(identity, [
    "-c",
    "user.name=CEW Eval",
    "-c",
    "user.email=eval@example.invalid",
    "commit",
    "--quiet",
    "--no-gpg-sign",
    "--allow-empty",
    "-m",
    "fixture baseline",
  ]);
  identity.gitRepository = true;
  for (const [relative, content] of Object.entries(gitFixture.dirtyFiles)) {
    writeWorkspaceFile(identity, relative, content);
  }
}

function buildFixture({ scenario, identity, baseline }) {
  let cleaned = false;
  return {
    scenario,
    identity,
    baseline,
    workspace: identity.workspace,
    async cleanup() {
      if (cleaned) return;
      try {
        await fs.promises.rm(identity.tempRoot, { recursive: true, force: true });
        cleaned = true;
      } catch (error) {
        throw new EvalError("E_FIXTURE", "cannot clean fixture workspace", 3, {
          cause: error.code,
        });
      }
    },
  };
}

module.exports = {
  SNAPSHOT_LIMITS,
  applyWorkspaceSnapshot,
  assertRootIdentity,
  createFixture,
  resolveWorkspacePath,
  snapshotTree,
  unexpectedWorkspaceChanges,
};
