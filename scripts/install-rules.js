#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

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

function copyRule({ source, root, relative, backupId, dryRun, log }) {
  const target = checkedPath(root, relative);
  const content = fs.readFileSync(source);
  if (fs.existsSync(target)) {
    const previous = fs.readFileSync(target);
    if (content.equals(previous)) return;
    const backup = checkedPath(root, path.posix.join(BACKUP_ROOT_NAME, backupId, relative));
    log(`${dryRun ? "[dry-run] " : ""}备份规则: ${backup}`);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.copyFileSync(target, backup);
    }
  }
  log(`${dryRun ? "[dry-run] " : ""}安装规则: ${target}`);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
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

function removeLegacyBakInDir(root, relDir, pattern, recursive, dryRun, log) {
  const dir = checkedPath(root, relDir);
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const childRel = relDir === "." ? entry.name : path.posix.join(relDir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) removeLegacyBakInDir(root, childRel, pattern, true, dryRun, log);
    } else if (entry.isFile() && pattern.test(entry.name)) {
      const target = checkedPath(root, childRel);
      log(`${dryRun ? "[dry-run] " : ""}清理历史备份: ${target}`);
      if (!dryRun) fs.unlinkSync(target);
    }
  }
}

function finalizeBackups({ installRoot, backupId, dryRun = false, log = console.log }) {
  const root = path.resolve(installRoot);
  if (!fs.existsSync(root)) return;
  removeLegacyBakInDir(root, ".", LEGACY_TOP_LEVEL_BAK, false, dryRun, log);
  removeLegacyBakInDir(root, "rules", LEGACY_RULE_BAK, true, dryRun, log);
  removeLegacyBakInDir(root, "references/rules", LEGACY_RULE_BAK, true, dryRun, log);

  const backupRoot = checkedPath(root, BACKUP_ROOT_NAME);
  if (!fs.existsSync(backupRoot)) return;
  const dirs = fs.readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort();
  if (dirs.length <= 1) return;
  const keep = backupId && dirs.includes(backupId) ? backupId : dirs[dirs.length - 1];
  for (const name of dirs) {
    if (name === keep) continue;
    const oldDir = checkedPath(root, path.posix.join(BACKUP_ROOT_NAME, name));
    log(`${dryRun ? "[dry-run] " : ""}清理旧备份目录: ${oldDir}`);
    if (!dryRun) fs.rmSync(oldDir, { recursive: true, force: true });
  }
}

function installRules({ sourceRoot, installRoot, host, backupId = defaultBackupId(), dryRun = false, log = console.log }) {
  if (!["claude-code", "codex"].includes(host)) throw new Error(`Invalid host: ${host}`);
  const root = path.resolve(installRoot);
  const rulesRoot = path.join(sourceRoot, "rules");
  const legacy = JSON.parse(fs.readFileSync(path.join(sourceRoot, "scripts/legacy-common-rule-hashes.json"), "utf8"));
  const files = fs.readdirSync(rulesRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name);
  const commonFiles = fs.readdirSync(path.join(rulesRoot, "common"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => `common/${entry.name}`);
  const installedOnDemand = (relative) => host === "claude-code" && !claudeResidentRules.has(relative);
  // Validate all managed destinations before the first write, including upgrade cleanup paths.
  checkedPath(root, BACKUP_ROOT_NAME);
  for (const relative of [...files, ...commonFiles]) {
    checkedPath(root, `rules/${relative}`);
    if (installedOnDemand(relative)) {
      checkedPath(root, `references/rules/${relative}`);
    }
  }
  for (const retired of retiredTopLevelRules) {
    checkedPath(root, `rules/${retired}`);
    if (host === "claude-code") checkedPath(root, `references/rules/${retired}`);
  }
  for (const relative of [...files, ...commonFiles]) {
    const source = path.join(rulesRoot, relative);
    const cold = installedOnDemand(relative);
    copyRule({ source, root, relative: `${cold ? "references/rules" : "rules"}/${relative}`, backupId, dryRun, log });
    if (cold) {
      retireRule({
        source, root, relative: `rules/${relative}`,
        knownHashes: legacy.files[relative] || [], dryRun, log,
      });
    }
  }
  for (const retired of retiredTopLevelRules) {
    const knownHashes = legacy.files[retired] || [];
    retireRule({ source: null, root, relative: `rules/${retired}`, knownHashes, dryRun, log });
    if (host === "claude-code") {
      retireRule({ source: null, root, relative: `references/rules/${retired}`, knownHashes, dryRun, log });
    }
  }
}

module.exports = { BACKUP_ROOT_NAME, installRules, finalizeBackups };

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
      backupId = argv[++i];
      if (!backupId || backupId.includes("/") || backupId.includes("\\") || backupId.includes("..")) {
        throw new Error("Invalid --backup-id");
      }
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
        throw new Error("Usage: install-rules.js <claude-code|codex> <install-root> [--backup-id <id>] [--dry-run]");
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
