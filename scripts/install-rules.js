#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const IMPLEMENTATION_RULE_BASE = ".cew-rule-state/02-implementation.base.md";
const IMPLEMENTATION_RULE_INCOMING = ".cew-rule-state/02-implementation.incoming.md";

const BACKUP_ROOT_NAME = ".cew-backups";
const LEGACY_TOP_LEVEL_BAK = /^(?:CLAUDE\.md|AGENTS\.md|settings\.json)\.bak\..+$/;
const LEGACY_RULE_BAK = /\.md\.bak\..+$/;

const digest = (content) => crypto.createHash("sha256")
  .update(content.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");

function defaultBackupId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Top-level rules stay in Claude's auto-loaded rules/; common/* loads on demand from references/rules/.
const claudeResidentRules = new Set(["01-base.md", "02-implementation.md", "05-git-workflow.md"]);
const retiredTopLevelRules = [
  "07-forbidden.md",
  "08-specialty-rules-index.md",
  "09-first-principles-adversarial-testing.md",
];

// Check the root and every descendant before touching a managed file; do not follow links.
function checkedPath(root, relative) {
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Path escapes install root: ${relative}`);
  }
  let cursor = target;
  for (;;) {
    try {
      if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`Refusing symlink: ${cursor}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (cursor === root) break;
    cursor = path.dirname(cursor);
  }
  return target;
}

function replaceFile(file, content, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + ".tmp-" + crypto.randomUUID();
  try {
    fs.writeFileSync(temp, content, { flag: "wx", mode: (mode & 0o777) | 0o200 });
    if (process.umask() & 0o200) {
      fs.chmodSync(temp, (fs.statSync(temp).mode & 0o777) | 0o200);
    }
    // Windows refuses to replace a target left read-only by an older installer.
    const priorMode = process.platform === "win32" && fs.existsSync(file) ? fs.statSync(file).mode : null;
    const readOnly = priorMode !== null && !(priorMode & 0o200);
    if (readOnly) fs.chmodSync(file, priorMode | 0o200);
    try {
      fs.renameSync(temp, file);
    } catch (error) {
      if (readOnly) fs.chmodSync(file, priorMode);
      throw error;
    }
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function copyRule({ source, root, relative, backupId, dryRun, log, merged, transformContent }) {
  const target = checkedPath(root, relative);
  let content;
  if (merged) {
    content = merged;
  } else {
    const raw = fs.readFileSync(source);
    content = transformContent
      ? Buffer.from(transformContent(relative, raw.toString("utf8")), "utf8")
      : raw;
  }
  const exists = fs.existsSync(target);
  if (exists) {
    const previous = fs.readFileSync(target);
    if (content.equals(previous)) return;
    const backup = checkedPath(root, path.posix.join(BACKUP_ROOT_NAME, backupId, relative));
    log(`${dryRun ? "[dry-run] " : ""}备份规则: ${backup}`);
    if (!dryRun) {
      replaceFile(backup, previous, fs.statSync(target).mode);
    }
  }
  log(`${dryRun ? "[dry-run] " : ""}安装规则: ${target}`);
  if (!dryRun) {
    replaceFile(target, content, fs.statSync(exists ? target : source).mode);
  }
}

// Git only sees disposable copies. A conflict, invalid text or missing Git leaves the live rule untouched.
function mergeRuleText(local, base, incoming) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cew-rule-merge-"));
  try {
    const paths = [];
    for (const [name, bytes] of [["local", local], ["base", base], ["incoming", incoming]]) {
      const text = bytes.toString("utf8");
      if (text.includes("\0") || !Buffer.from(text).equals(bytes)) return null;
      const file = path.join(scratch, name);
      fs.writeFileSync(file, text.replace(/\r\n/g, "\n"));
      paths.push(file);
    }
    const result = spawnSync("git", ["merge-file", "-p", "--", ...paths], { cwd: scratch });
    if (result.status !== 0 || result.error) return null;
    const crlf = local.includes("\r\n") && !local.toString("utf8").replace(/\r\n/g, "").includes("\n");
    return crlf ? Buffer.from(result.stdout.toString("utf8").replace(/\n/g, "\r\n")) : result.stdout;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function installMergedImplementationRule(options, knownHashes, hostLabel) {
  const { source, root, relative, dryRun, log } = options;
  const target = checkedPath(root, relative);
  const base = checkedPath(root, IMPLEMENTATION_RULE_BASE);
  const incoming = checkedPath(root, IMPLEMENTATION_RULE_INCOMING);
  const previous = fs.existsSync(base) ? fs.readFileSync(base) : null;
  const local = fs.existsSync(target) ? fs.readFileSync(target) : null;
  const next = fs.readFileSync(source);
  const localHash = local && digest(local);
  const pristine = !local || localHash === digest(next) ||
    (previous ? localHash === digest(previous) : knownHashes.includes(localHash));

  if (pristine) {
    copyRule(options);
  } else if (previous && digest(previous) !== digest(next)) {
    const merged = mergeRuleText(local, previous, next);
    if (!merged) {
      log(`${dryRun ? "[dry-run] " : ""}无法自动合并，保留个人规则 ${target}。请对照 ${incoming} 手动合并，再用它更新基线 ${base}。`);
      if (!dryRun) replaceFile(incoming, next);
      return;
    }
    copyRule({ ...options, merged });
  } else {
    log(`保留 ${hostLabel} 个人实现规则: ${target}`);
  }
  if (!dryRun) {
    if (!previous || !previous.equals(next)) replaceFile(base, next);
    fs.rmSync(incoming, { force: true });
  }
}

function installPromotedRule({ source, root, relative, knownHashes, backupId, dryRun, log }) {
  const oldPath = checkedPath(root, `references/rules/${relative}`);
  const destination = `rules/${relative}`;
  const resident = checkedPath(root, destination);
  const distributed = new Set([...knownHashes, digest(fs.readFileSync(source))]);
  const personalContent = (file) => {
    if (!fs.existsSync(file)) return null;
    const content = fs.readFileSync(file);
    return distributed.has(digest(content)) ? null : content;
  };
  const residentPolicy = personalContent(resident);
  const oldPolicy = personalContent(oldPath);
  if (residentPolicy) {
    log(`保留常驻个人规则: ${resident}`);
    if (oldPolicy && !residentPolicy.equals(oldPolicy)) {
      log(`保留内容不同的个人参考副本: ${oldPath}`);
      return;
    }
  } else {
    copyRule({ source: oldPolicy ? oldPath : source, root, relative: destination, backupId, dryRun, log });
  }
  if (fs.existsSync(oldPath)) {
    log(`${dryRun ? "[dry-run] " : ""}移除已迁入常驻目录的规则: ${oldPath}`);
    if (!dryRun) fs.unlinkSync(oldPath);
  }
}

function retireRule({ source, root, relative, knownHashes, dryRun, log }) {
  const target = checkedPath(root, relative);
  if (!fs.existsSync(target)) return;
  const hash = digest(fs.readFileSync(target));
  const matchesSource = source && fs.existsSync(source) && hash === digest(fs.readFileSync(source));
  if (!matchesSource && !knownHashes.includes(hash)) {
    log(`保留个人修改，仍可能自动加载: ${target}`);
    return;
  }
  log(`${dryRun ? "[dry-run] " : ""}移除已迁移的分发规则: ${target}`);
  if (!dryRun) fs.unlinkSync(target);
}

function archiveLegacyBackups(root, relDir, pattern, recursive, dryRun, log) {
  const dir = checkedPath(root, relDir);
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const childRel = relDir === "." ? entry.name : path.posix.join(relDir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) archiveLegacyBackups(root, childRel, pattern, true, dryRun, log);
    } else if (entry.isFile() && pattern.test(entry.name)) {
      const target = checkedPath(root, childRel);
      const archive = checkedPath(root, path.join(BACKUP_ROOT_NAME, "legacy", childRel));
      log(`${dryRun ? "[dry-run] " : ""}归档历史备份: ${target}`);
      if (dryRun) continue;
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      try {
        fs.copyFileSync(target, archive, fs.constants.COPYFILE_EXCL);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (!fs.readFileSync(target).equals(fs.readFileSync(archive))) continue;
      }
      fs.unlinkSync(target);
    }
  }
}

// Snapshots are sparse. Only retire a file after seeing a newer backup of the same path.
function pruneSupersededFiles(snapshot, relative, seen, dryRun, log) {
  const dir = checkedPath(snapshot, relative);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      pruneSupersededFiles(snapshot, child, seen, dryRun, log);
    } else if (entry.isFile()) {
      if (seen.has(child)) {
        const file = checkedPath(snapshot, child);
        log(`${dryRun ? "[dry-run] " : ""}清理已有较新副本的备份: ${file}`);
        if (!dryRun) fs.unlinkSync(file);
      }
      seen.add(child);
    }
  }
  if (!dryRun && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

function finalizeBackups({ installRoot, dryRun = false, log = console.log }) {
  const root = path.resolve(installRoot);
  if (!fs.existsSync(root)) return;
  archiveLegacyBackups(root, ".", LEGACY_TOP_LEVEL_BAK, false, dryRun, log);
  archiveLegacyBackups(root, "rules", LEGACY_RULE_BAK, true, dryRun, log);
  archiveLegacyBackups(root, "references/rules", LEGACY_RULE_BAK, true, dryRun, log);

  const backupRoot = checkedPath(root, BACKUP_ROOT_NAME);
  if (!fs.existsSync(backupRoot)) return;
  const snapshots = fs.readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{14}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort().reverse();
  const seen = new Set();
  for (const snapshot of snapshots) {
    pruneSupersededFiles(checkedPath(backupRoot, snapshot), "", seen, dryRun, log);
  }
}

function validateBackupId(backupId) {
  if (
    !backupId ||
    backupId === "." ||
    backupId.includes("/") ||
    backupId.includes("\\") ||
    backupId.includes("..")
  ) {
    throw new Error("Invalid --backup-id");
  }
  return backupId;
}

function getHostRulePolicy(host) {
  if (host === "claude-code") {
    return {
      dirFor: (relative) => (claudeResidentRules.has(relative) ? "rules" : "references/rules"),
      mergedRule: null,
      promotedRule: "02-implementation.md",
      retireColdFromRules: true,
      retiredDirs: ["rules", "references/rules"],
    };
  }
  if (host === "codex") {
    return {
      dirFor: () => "rules",
      mergedRule: { relative: "rules/02-implementation.md", hostLabel: "Codex" },
      promotedRule: null,
      retireColdFromRules: false,
      retiredDirs: ["rules"],
    };
  }
  if (host === "antigravity") {
    return {
      dirFor: () => "references/rules",
      mergedRule: { relative: "references/rules/02-implementation.md", hostLabel: "Antigravity" },
      promotedRule: null,
      retireColdFromRules: false,
      retiredDirs: ["references/rules"],
    };
  }
  throw new Error(`Invalid host: ${host}`);
}

function collectRuleSources(sourceRoot) {
  const rulesRoot = path.join(sourceRoot, "rules");
  const files = fs.readdirSync(rulesRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name);
  const commonFiles = fs.readdirSync(path.join(rulesRoot, "common"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => `common/${entry.name}`);
  return { rulesRoot, relatives: [...files, ...commonFiles] };
}

function validateRuleTargets({ sourceRoot, installRoot, host }) {
  const policy = getHostRulePolicy(host);
  const root = path.resolve(installRoot);
  const { rulesRoot, relatives } = collectRuleSources(sourceRoot);
  // Validate all managed destinations before the first write, including upgrade cleanup paths.
  checkedPath(root, BACKUP_ROOT_NAME);
  if (policy.mergedRule) {
    checkedPath(root, IMPLEMENTATION_RULE_BASE);
    checkedPath(root, IMPLEMENTATION_RULE_INCOMING);
  }
  for (const relative of relatives) {
    const targetDir = policy.dirFor(relative);
    checkedPath(root, `${targetDir}/${relative}`);
    if (policy.retireColdFromRules && targetDir === "references/rules") {
      checkedPath(root, `rules/${relative}`);
    }
    if (policy.promotedRule === relative) {
      checkedPath(root, `rules/${relative}`);
      checkedPath(root, `references/rules/${relative}`);
    }
  }
  for (const retired of retiredTopLevelRules) {
    for (const dir of policy.retiredDirs) {
      checkedPath(root, `${dir}/${retired}`);
    }
  }
  return { policy, root, rulesRoot, relatives };
}

function installRules({
  sourceRoot,
  installRoot,
  host,
  backupId = defaultBackupId(),
  dryRun = false,
  log = console.log,
  transformContent,
}) {
  validateBackupId(backupId);
  const { policy, root, rulesRoot, relatives } = validateRuleTargets({ sourceRoot, installRoot, host });
  const legacy = JSON.parse(fs.readFileSync(path.join(sourceRoot, "scripts/legacy-common-rule-hashes.json"), "utf8"));
  for (const relative of relatives) {
    const source = path.join(rulesRoot, relative);
    if (policy.mergedRule && relative === "02-implementation.md") {
      installMergedImplementationRule(
        { source, root, relative: policy.mergedRule.relative, backupId, dryRun, log },
        legacy.files[relative] || [],
        policy.mergedRule.hostLabel,
      );
      continue;
    }
    if (policy.promotedRule === relative) {
      installPromotedRule({ source, root, relative, knownHashes: legacy.files[relative] || [], backupId, dryRun, log });
      continue;
    }
    const targetDir = policy.dirFor(relative);
    copyRule({ source, root, relative: `${targetDir}/${relative}`, backupId, dryRun, log, transformContent });
    if (policy.retireColdFromRules && targetDir === "references/rules") {
      retireRule({
        source, root, relative: `rules/${relative}`,
        knownHashes: legacy.files[relative] || [], dryRun, log,
      });
    }
  }
  for (const retired of retiredTopLevelRules) {
    const knownHashes = legacy.files[retired] || [];
    for (const dir of policy.retiredDirs) {
      retireRule({ source: null, root, relative: `${dir}/${retired}`, knownHashes, dryRun, log });
    }
  }
}

module.exports = {
  BACKUP_ROOT_NAME,
  checkedPath,
  defaultBackupId,
  validateBackupId,
  validateRuleTargets,
  installRules,
  finalizeBackups,
};

function parseCli(argv) {
  let dryRun = false;
  let backupId;
  let finalize = false;
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--finalize-backups") {
      finalize = true;
    } else if (arg === "--backup-id") {
      backupId = validateBackupId(argv[++i]);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  return { dryRun, backupId, finalize, positional };
}

if (require.main === module) {
  try {
    const { dryRun, backupId, finalize, positional } = parseCli(process.argv.slice(2));
    if (finalize) {
      const [installRoot] = positional;
      if (!installRoot || positional.length !== 1) {
        throw new Error("Usage: install-rules.js --finalize-backups <install-root> [--backup-id <id>] [--dry-run]");
      }
      finalizeBackups({ installRoot, backupId, dryRun });
    } else {
      const [host, installRoot] = positional;
      if (!host || !installRoot || positional.length !== 2) {
        throw new Error("Usage: install-rules.js <claude-code|codex|antigravity> <install-root> [--backup-id <id>] [--dry-run]");
      }
      installRules({
        sourceRoot: path.resolve(__dirname, ".."),
        installRoot,
        host,
        backupId: backupId || defaultBackupId(),
        dryRun,
      });
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
