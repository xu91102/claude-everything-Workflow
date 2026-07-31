#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function usage() {
  console.error(
    "Usage: node scripts/cleanup-retired-skills.js <install-root> [--dry-run|--prepare] [--manifest <path>]\n" +
      "       node scripts/cleanup-retired-skills.js --validate [--manifest <path>]",
  );
}

function isSafeRelative(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !path.isAbsolute(value) &&
    !value.split(/[\\/]/).includes("..")
  );
}

function normalizeKnownFile(entry, label, skill) {
  if (
    !entry ||
    typeof entry !== "object" ||
    Array.isArray(entry) ||
    !isSafeRelative(entry.path) ||
    !Array.isArray(entry.sha256) ||
    entry.sha256.length === 0 ||
    entry.sha256.some(
      (hash) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash),
    )
  ) {
    throw new Error(`Invalid ${label} entry: ${skill}`);
  }
  return {
    path: entry.path.split(/[\\/]/).join("/"),
    sha256: new Set(entry.sha256),
  };
}

function validateManifest(manifest) {
  if (
    !manifest ||
    manifest.version !== 2 ||
    !manifest.retired_skills ||
    typeof manifest.retired_skills !== "object" ||
    Array.isArray(manifest.retired_skills)
  ) {
    throw new Error("Invalid retired skill manifest");
  }

  const validateFileMap = (fileMap, label) => {
    if (!fileMap || typeof fileMap !== "object" || Array.isArray(fileMap)) {
      throw new Error(`Invalid ${label} manifest section`);
    }
    return Object.entries(fileMap).map(([skill, knownFiles]) => {
      if (
        !isSafeRelative(skill) ||
        !Array.isArray(knownFiles) ||
        knownFiles.length === 0
      ) {
        throw new Error(`Invalid ${label} entry: ${skill}`);
      }
      return [
        skill,
        knownFiles.map((entry) => normalizeKnownFile(entry, label, skill)),
      ];
    });
  };

  return {
    retiredSkills: validateFileMap(manifest.retired_skills, "retired skill"),
    staleSkillFiles: validateFileMap(
      manifest.stale_skill_files,
      "stale skill file",
    ),
  };
}

function hasSymlinkParent(root, target) {
  let cursor = path.dirname(target);
  while (cursor.startsWith(`${root}${path.sep}`)) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
      return true;
    }
    cursor = path.dirname(cursor);
  }
  return false;
}

function listUnknownFiles(directory, knownFiles, base = directory) {
  if (!fs.existsSync(directory)) return [];

  const unknown = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(base, absolute).split(path.sep).join("/");
    if (entry.isSymbolicLink()) {
      if (!knownFiles.has(relative)) unknown.push(relative);
    } else if (entry.isDirectory()) {
      unknown.push(...listUnknownFiles(absolute, knownFiles, base));
    } else if (!knownFiles.has(relative)) {
      unknown.push(relative);
    }
  }
  return unknown;
}

function collectKnownDirectories(skillRoot, relative, directories) {
  let cursor = path.dirname(path.join(skillRoot, relative));
  while (cursor.startsWith(`${skillRoot}${path.sep}`)) {
    directories.add(cursor);
    cursor = path.dirname(cursor);
  }
}

function fileSha256(target) {
  return crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
}

function preserveCustomizedFile(target, digest, dryRun) {
  const backup = `${target}.retired-backup-${digest.slice(0, 12)}`;
  console.log(
    `${dryRun ? "[dry-run] " : ""}Preserve customized retired file: ${target}`,
  );
  console.log(
    `${dryRun ? "[dry-run] " : ""}Backup customized retired file: ${backup}`,
  );
  if (dryRun) return;

  const backupStat = fs.lstatSync(backup, { throwIfNoEntry: false });
  if (backupStat) {
    if (
      backupStat.isSymbolicLink() ||
      !backupStat.isFile() ||
      fileSha256(backup) !== digest
    ) {
      throw new Error(`Unsafe retired backup collision: ${backup}`);
    }
    return;
  }
  fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
}

function removeKnownFiles({
  skillRoot,
  knownFiles,
  directories,
  dryRun,
  prepareOnly,
}) {
  let customized = false;

  for (const knownFile of knownFiles) {
    const target = path.join(skillRoot, knownFile.path);
    collectKnownDirectories(skillRoot, knownFile.path, directories);
    if (hasSymlinkParent(skillRoot, target)) {
      console.log(`Preserving retired path through symlink: ${target}`);
      continue;
    }
    if (!fs.existsSync(target)) continue;

    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) {
      console.log(`Preserving symlinked retired file: ${target}`);
      continue;
    }
    if (!stat.isFile()) {
      console.log(`Preserving non-file retired path: ${target}`);
      continue;
    }

    const digest = fileSha256(target);
    if (!knownFile.sha256.has(digest)) {
      preserveCustomizedFile(target, digest, dryRun);
      customized = true;
      continue;
    }
    if (prepareOnly) continue;

    console.log(`${dryRun ? "[dry-run] " : ""}Remove retired file: ${target}`);
    if (!dryRun) fs.unlinkSync(target);
  }

  return customized;
}

function removeEmptyKnownDirectories(directories) {
  for (const directory of [...directories].sort(
    (left, right) => right.length - left.length,
  )) {
    if (!fs.existsSync(directory)) continue;
    const stat = fs.lstatSync(directory);
    if (
      !stat.isSymbolicLink() &&
      stat.isDirectory() &&
      fs.readdirSync(directory).length === 0
    ) {
      fs.rmdirSync(directory);
    }
  }
}

function cleanupSkill({
  installRoot,
  skill,
  knownFiles,
  dryRun,
  prepareOnly,
  reportUnknown,
}) {
  const skillRoot = path.join(installRoot, "skills", skill);
  const directories = new Set(reportUnknown ? [skillRoot] : []);
  const knownFileSet = new Set(knownFiles.map((entry) => entry.path));
  if (fs.existsSync(skillRoot) && fs.lstatSync(skillRoot).isSymbolicLink()) {
    console.log(`Preserving symlinked retired skill: ${skillRoot}`);
    return false;
  }

  const customized = removeKnownFiles({
    skillRoot,
    knownFiles,
    directories,
    dryRun,
    prepareOnly,
  });
  if (prepareOnly) return customized;
  if (dryRun && fs.existsSync(skillRoot)) {
    if (reportUnknown) {
      for (const relative of listUnknownFiles(skillRoot, knownFileSet)) {
        console.log(
          `[dry-run] Preserve unknown retired skill path: ${path.join(skillRoot, relative)}`,
        );
      }
    }
    console.log(
      `[dry-run] Remove empty directories under retired skill: ${skillRoot}`,
    );
    return customized;
  }

  removeEmptyKnownDirectories(directories);
  if (reportUnknown && fs.existsSync(skillRoot)) {
    console.log(`Preserving unknown files in retired skill: ${skillRoot}`);
  }
  return customized;
}

function parseArgs(argv) {
  let dryRun = false;
  let validateOnly = false;
  let prepareOnly = false;
  let manifestPath = path.join(__dirname, "retired-skill-files.json");
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") {
      dryRun = true;
    } else if (value === "--validate") {
      validateOnly = true;
    } else if (value === "--prepare") {
      prepareOnly = true;
    } else if (value === "--manifest") {
      const next = argv[index + 1];
      if (!next) throw new Error("--manifest requires a path");
      manifestPath = path.resolve(next);
      index += 1;
    } else {
      positional.push(value);
    }
  }

  return { dryRun, manifestPath, positional, prepareOnly, validateOnly };
}

function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    usage();
    return 2;
  }

  const {
    dryRun,
    manifestPath,
    positional,
    prepareOnly,
    validateOnly,
  } = args;
  if (
    (validateOnly && (dryRun || prepareOnly || positional.length !== 0)) ||
    (prepareOnly && dryRun) ||
    (!validateOnly && positional.length !== 1)
  ) {
    usage();
    return 2;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const { retiredSkills, staleSkillFiles } = validateManifest(manifest);
  if (validateOnly) return 0;

  const installRoot = path.resolve(positional[0]);
  const skillsRoot = path.join(installRoot, "skills");
  if (fs.existsSync(skillsRoot) && fs.lstatSync(skillsRoot).isSymbolicLink()) {
    console.log(`Preserving symlinked skills root: ${skillsRoot}`);
    return 0;
  }

  let customized = false;
  for (const [skill, knownFiles] of retiredSkills) {
    customized =
      cleanupSkill({
        installRoot,
        skill,
        knownFiles,
        dryRun,
        prepareOnly,
        reportUnknown: true,
      }) || customized;
  }
  for (const [skill, knownFiles] of staleSkillFiles) {
    customized =
      cleanupSkill({
        installRoot,
        skill,
        knownFiles,
        dryRun,
        prepareOnly,
        reportUnknown: false,
      }) || customized;
  }

  if (customized && !dryRun) {
    console.error(
      "Customized retired files were preserved with backups; review them before retrying.",
    );
    return 3;
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

module.exports = { main, validateManifest };
