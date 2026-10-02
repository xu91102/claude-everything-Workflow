#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const digest = (content) => crypto.createHash("sha256")
  .update(content.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");

// Codex execution policies share the rules directory; a prose mention of prefix_rule is not a policy.
const protectedPolicy = (file, content) => path.basename(file).endsWith(".rules") ||
  /^\s*prefix_rule\s*\(/m.test(content.toString("utf8"));

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

function copyRule({ source, root, relative, knownHashes, dryRun, log }) {
  const target = checkedPath(root, relative);
  const content = fs.readFileSync(source);
  if (protectedPolicy(relative, content)) {
    log(`跳过执行权限规则源文件: ${source}`);
    return;
  }
  if (fs.existsSync(target)) {
    const previous = fs.readFileSync(target);
    if (protectedPolicy(relative, previous)) {
      log(`保留执行权限规则: ${target}`);
      return;
    }
    if (content.equals(previous)) return;
    if (digest(content) !== digest(previous) && !knownHashes.includes(digest(previous))) {
      log(`保留个人修改: ${target}`);
      return;
    }
    const backup = checkedPath(root, relative + ".bak." + digest(previous));
    log(`${dryRun ? "[dry-run] " : ""}备份规则: ${backup}`);
    if (!dryRun && !fs.existsSync(backup)) fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
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
  const content = fs.readFileSync(target);
  if (protectedPolicy(relative, content)) {
    log(`保留执行权限规则: ${target}`);
    return;
  }
  const hash = digest(content);
  if ((!source || hash !== digest(fs.readFileSync(source))) && !knownHashes.includes(hash)) {
    log(`保留个人修改，仍可能自动加载: ${target}`);
    return;
  }
  log(`${dryRun ? "[dry-run] " : ""}移除已迁移的分发规则: ${target}`);
  if (!dryRun) fs.unlinkSync(target);
}

function installRules({ sourceRoot, installRoot, host, dryRun = false, log = console.log }) {
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
  const retiredFiles = Object.keys(legacy.files).filter((relative) =>
    /^(?:common\/)?[a-z0-9-]+\.md$/.test(relative) &&
    !files.includes(relative) && !commonFiles.includes(relative));
  // Validate all managed destinations before the first write, including upgrade cleanup paths.
  for (const relative of [...files, ...commonFiles, ...retiredFiles]) {
    checkedPath(root, `rules/${relative}`);
    if (host === "claude-code" && relative.startsWith("common/")) {
      checkedPath(root, `references/rules/${relative}`);
    }
  }
  for (const relative of [...files, ...commonFiles]) {
    const source = path.join(rulesRoot, relative);
    const cold = host === "claude-code" && relative.startsWith("common/");
    copyRule({ source, root, relative: `${cold ? "references/rules" : "rules"}/${relative}`,
      knownHashes: legacy.files[relative] || [], dryRun, log });
    if (cold) retireRule({ source, root, relative: `rules/${relative}`,
      knownHashes: legacy.files[relative] || [], dryRun, log });
  }
  for (const relative of retiredFiles) {
    const locations = [`rules/${relative}`];
    if (host === "claude-code" && relative.startsWith("common/")) {
      locations.push(`references/rules/${relative}`);
    }
    for (const location of locations) {
      retireRule({ root, relative: location, knownHashes: legacy.files[relative], dryRun, log });
    }
  }
}

module.exports = { installRules };

if (require.main === module) {
  const [host, installRoot, ...options] = process.argv.slice(2);
  try {
    if (!installRoot || options.some((option) => option !== "--dry-run")) {
      throw new Error("Usage: install-rules.js <claude-code|codex> <install-root> [--dry-run]");
    }
    installRules({ sourceRoot: path.resolve(__dirname, ".."), installRoot, host,
      dryRun: options.includes("--dry-run") });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
