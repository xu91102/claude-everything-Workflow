#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { validateManifest } = require("./cleanup-retired-skills");

const OBSOLETE_TARGETS = [
  "scripts/hooks/run-with-flags.js",
  "scripts/hooks/commit-quality.js",
  "scripts/hooks/session-start.js",
  "scripts/hooks/session-end.js",
  "scripts/lib/hook-flags.js",
  "scripts/lib/utils.js",
  "hooks/review-confidence.js",
  "hooks/session-start.js",
  "hooks/session-end.js",
  "hooks/evaluate-session.js",
  "hooks/pre-compact.js",
  "hooks/runtime/session-utils.js",
];

function isWithin(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function assertSafeRelative(relative) {
  if (
    typeof relative !== "string" ||
    relative.length === 0 ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`Unsafe install target: ${relative}`);
  }
}

function lstatIfPresent(target) {
  return fs.lstatSync(target, { throwIfNoEntry: false });
}

function sha256(target) {
  return crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
}

function assertNotSymlink(target) {
  const stat = lstatIfPresent(target);
  if (stat?.isSymbolicLink()) {
    throw new Error(`Unsafe install target through symlink: ${target}`);
  }
}

function assertBackupAvailable(source, target, sourceStat, targetStat) {
  if (!sourceStat.isFile() || !targetStat?.isFile()) return;
  if (sha256(source) === sha256(target)) return;

  const digest = sha256(target);
  const backup = `${target}.distribution-backup-${digest.slice(0, 12)}`;
  const backupStat = lstatIfPresent(backup);
  if (
    backupStat &&
    (backupStat.isSymbolicLink() ||
      !backupStat.isFile() ||
      sha256(backup) !== digest)
  ) {
    throw new Error(`Unsafe distribution backup collision: ${backup}`);
  }
}

function scanSourceMapping(source, target) {
  if (!fs.existsSync(source)) return;
  const sourceStat = fs.lstatSync(source);
  if (sourceStat.isSymbolicLink()) {
    throw new Error(`Unsafe symlink in install source: ${source}`);
  }

  assertNotSymlink(target);
  const targetStat = lstatIfPresent(target);
  if (targetStat) {
    if (
      (sourceStat.isDirectory() && !targetStat.isDirectory()) ||
      (sourceStat.isFile() && !targetStat.isFile())
    ) {
      throw new Error(`Unsafe install target type mismatch: ${target}`);
    }
    assertBackupAvailable(source, target, sourceStat, targetStat);
  }
  if (!sourceStat.isDirectory()) return;
  for (const entry of fs.readdirSync(source)) {
    scanSourceMapping(path.join(source, entry), path.join(target, entry));
  }
}

function retiredTargets(sourceRoot) {
  const manifestPath = path.join(
    sourceRoot,
    "scripts",
    "retired-skill-files.json",
  );
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const { retiredSkills, staleSkillFiles } = validateManifest(manifest);
  return [...retiredSkills, ...staleSkillFiles].flatMap(([skill, files]) =>
    files.map((file) => path.join("skills", skill, file.path)),
  );
}

function preflight(sourceRoot, installRoot, relatives) {
  const source = path.resolve(sourceRoot);
  const root = path.resolve(installRoot);
  assertNotSymlink(root);

  const allTargets = new Set([
    ...relatives,
    ...OBSOLETE_TARGETS,
    ...retiredTargets(source),
  ]);
  for (const relative of allTargets) {
    assertSafeRelative(relative);
    const target = path.resolve(root, relative);
    if (!isWithin(root, target)) {
      throw new Error(`Unsafe install target outside root: ${target}`);
    }

    let cursor = target;
    while (isWithin(root, cursor)) {
      assertNotSymlink(cursor);
      if (cursor === root) break;
      cursor = path.dirname(cursor);
    }
    if (relatives.includes(relative)) {
      scanSourceMapping(path.join(source, relative), target);
    }
  }
}

function main(argv = process.argv.slice(2)) {
  if (argv.length < 3) {
    console.error(
      "Usage: node scripts/preflight-install-paths.js <source-root> <install-root> <relative-target>...",
    );
    return 2;
  }

  preflight(argv[0], argv[1], argv.slice(2));
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { main, preflight };
