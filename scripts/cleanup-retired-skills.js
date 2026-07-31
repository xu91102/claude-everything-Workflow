#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function writeLine(message) {
  process.stdout.write(`${message}\n`);
}

function usage() {
  process.stderr.write(
    "Usage: node scripts/cleanup-retired-skills.js <install-root> [--dry-run]\n" +
      "       node scripts/cleanup-retired-skills.js --validate\n",
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

function validateManifest(manifest) {
  if (
    !manifest ||
    manifest.version !== 1 ||
    !manifest.retired_skills ||
    typeof manifest.retired_skills !== "object" ||
    Array.isArray(manifest.retired_skills)
  ) {
    throw new Error("Invalid retired skill manifest");
  }

  const entries = Object.entries(manifest.retired_skills);
  for (const [skill, knownFiles] of entries) {
    if (
      !isSafeRelative(skill) ||
      !Array.isArray(knownFiles) ||
      knownFiles.some((relative) => !isSafeRelative(relative))
    ) {
      throw new Error(`Invalid retired skill entry: ${skill}`);
    }
  }
  return entries;
}

function lstatIfExists(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }
}

function hasSymlinkParent(root, target) {
  let cursor = path.dirname(target);
  while (cursor.startsWith(`${root}${path.sep}`)) {
    const stat = lstatIfExists(cursor);
    if (stat?.isSymbolicLink()) return true;
    cursor = path.dirname(cursor);
  }
  return false;
}

function listUnknownPaths(directory, knownFiles, base = directory) {
  if (!lstatIfExists(directory)) return [];

  const unknown = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(base, absolute).split(path.sep).join("/");
    if (entry.isSymbolicLink()) {
      if (!knownFiles.has(relative)) unknown.push(relative);
    } else if (entry.isDirectory()) {
      unknown.push(...listUnknownPaths(absolute, knownFiles, base));
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

function removeKnownFiles({ skillRoot, knownFiles, directories, dryRun }) {
  for (const relative of knownFiles) {
    const target = path.join(skillRoot, relative);
    collectKnownDirectories(skillRoot, relative, directories);
    if (hasSymlinkParent(skillRoot, target)) {
      writeLine(`Preserving retired path through symlink: ${target}`);
      continue;
    }
    const stat = lstatIfExists(target);
    if (!stat) continue;
    if (stat.isSymbolicLink()) {
      writeLine(`Preserving symlinked retired file: ${target}`);
      continue;
    }
    if (!stat.isFile()) {
      writeLine(`Preserving non-file retired path: ${target}`);
      continue;
    }
    writeLine(`${dryRun ? "[dry-run] " : ""}Remove retired file: ${target}`);
    if (!dryRun) fs.unlinkSync(target);
  }
}

function removeEmptyKnownDirectories(directories) {
  const deepestFirst = [...directories].sort(
    (left, right) => right.length - left.length,
  );
  for (const directory of deepestFirst) {
    const stat = lstatIfExists(directory);
    if (!stat) continue;
    if (
      !stat.isSymbolicLink() &&
      stat.isDirectory() &&
      fs.readdirSync(directory).length === 0
    ) {
      fs.rmdirSync(directory);
    }
  }
}

function cleanupSkill({ installRoot, skill, knownFiles, dryRun }) {
  const skillRoot = path.join(installRoot, "skills", skill);
  const directories = new Set([skillRoot]);
  const knownFileSet = new Set(
    knownFiles.map((relative) => relative.split(/[\\/]/).join("/")),
  );
  const skillRootStat = lstatIfExists(skillRoot);
  if (skillRootStat?.isSymbolicLink()) {
    writeLine(`Preserving symlinked retired skill: ${skillRoot}`);
    return;
  }
  if (skillRootStat && !skillRootStat.isDirectory()) {
    writeLine(`Preserving non-directory retired skill path: ${skillRoot}`);
    return;
  }

  removeKnownFiles({ skillRoot, knownFiles, directories, dryRun });
  if (dryRun && lstatIfExists(skillRoot)) {
    for (const relative of listUnknownPaths(skillRoot, knownFileSet)) {
      writeLine(
        `[dry-run] Preserve unknown retired skill path: ${path.join(skillRoot, relative)}`,
      );
    }
    writeLine(
      `[dry-run] Remove empty directories under retired skill: ${skillRoot}`,
    );
    return;
  }

  removeEmptyKnownDirectories(directories);
  if (lstatIfExists(skillRoot)) {
    writeLine(`Preserving unknown files in retired skill: ${skillRoot}`);
  }
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  const validateOnly = argv.includes("--validate");
  const positional = argv.filter(
    (value) => value !== "--dry-run" && value !== "--validate",
  );
  if (
    (validateOnly && (dryRun || positional.length !== 0)) ||
    (!validateOnly && positional.length !== 1)
  ) {
    usage();
    return 2;
  }

  const manifestPath = path.join(__dirname, "retired-skill-files.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const retiredSkills = validateManifest(manifest);
  if (validateOnly) return 0;

  const installRoot = path.resolve(positional[0]);
  const skillsRoot = path.join(installRoot, "skills");
  const skillsRootStat = lstatIfExists(skillsRoot);
  if (skillsRootStat?.isSymbolicLink()) {
    writeLine(`Preserving symlinked skills root: ${skillsRoot}`);
    return 0;
  }
  if (skillsRootStat && !skillsRootStat.isDirectory()) {
    throw new Error(`Expected skills directory: ${skillsRoot}`);
  }

  for (const [skill, knownFiles] of retiredSkills) {
    cleanupSkill({ installRoot, skill, knownFiles, dryRun });
  }
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
