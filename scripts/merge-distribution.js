#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function sha256(target) {
  return crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
}

function lstatIfPresent(target) {
  return fs.lstatSync(target, { throwIfNoEntry: false });
}

function backupFileIfChanged(source, destination, dryRun) {
  const current = lstatIfPresent(destination);
  if (current) {
    if (!current.isFile() || current.isSymbolicLink()) {
      throw new Error(`Unsafe distribution target type: ${destination}`);
    }
    if (sha256(source) === sha256(destination)) return false;
    const currentDigest = sha256(destination);
    const backup = `${destination}.distribution-backup-${currentDigest.slice(0, 12)}`;
    console.log(`${dryRun ? "[dry-run] " : ""}Backup customized file: ${backup}`);
    const backupStat = lstatIfPresent(backup);
    if (!dryRun && backupStat) {
      if (
        backupStat.isSymbolicLink() ||
        !backupStat.isFile() ||
        sha256(backup) !== currentDigest
      ) {
        throw new Error(`Unsafe distribution backup collision: ${backup}`);
      }
    } else if (!dryRun) {
      fs.copyFileSync(destination, backup, fs.constants.COPYFILE_EXCL);
    }
    return true;
  }
  return false;
}

function copyFileWithBackup(source, destination, dryRun) {
  backupFileIfChanged(source, destination, dryRun);

  console.log(`${dryRun ? "[dry-run] " : ""}Install distribution file: ${destination}`);
  if (dryRun) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  if (process.platform !== "win32") {
    fs.chmodSync(destination, fs.statSync(source).mode);
  }
}

function mergeDirectory(source, destination, dryRun = false) {
  const sourceStat = fs.lstatSync(source);
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    throw new Error(`Invalid distribution source directory: ${source}`);
  }
  const targetStat = lstatIfPresent(destination);
  if (targetStat) {
    if (targetStat.isSymbolicLink() || !targetStat.isDirectory()) {
      throw new Error(`Unsafe distribution target directory: ${destination}`);
    }
  } else if (!dryRun) {
    fs.mkdirSync(destination, { recursive: true });
  }

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Symlinked distribution source is not allowed: ${sourcePath}`);
    }
    if (entry.isDirectory()) {
      mergeDirectory(sourcePath, destinationPath, dryRun);
    } else if (entry.isFile()) {
      copyFileWithBackup(sourcePath, destinationPath, dryRun);
    } else {
      throw new Error(`Unsupported distribution source type: ${sourcePath}`);
    }
  }
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  const fileMode = argv.includes("--file");
  const backupOnly = argv.includes("--backup-only");
  const positional = argv.filter(
    (item) => !["--dry-run", "--file", "--backup-only"].includes(item),
  );
  if (positional.length !== 2) {
    console.error(
      "Usage: merge-distribution.js <source> <destination> [--file] [--backup-only] [--dry-run]",
    );
    return 2;
  }
  const source = path.resolve(positional[0]);
  const destination = path.resolve(positional[1]);
  if (backupOnly && !fileMode) {
    throw new Error("--backup-only requires --file");
  }
  if (fileMode) {
    const sourceStat = lstatIfPresent(source);
    if (!sourceStat?.isFile() || sourceStat.isSymbolicLink()) {
      throw new Error(`Invalid distribution source file: ${source}`);
    }
    if (backupOnly) {
      backupFileIfChanged(source, destination, dryRun);
    } else {
      copyFileWithBackup(source, destination, dryRun);
    }
  } else {
    mergeDirectory(source, destination, dryRun);
  }
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

module.exports = {
  backupFileIfChanged,
  copyFileWithBackup,
  main,
  mergeDirectory,
};
