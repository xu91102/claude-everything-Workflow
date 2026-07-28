#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function usage() {
  console.error(
    "Usage: node scripts/cleanup-retired-skills.js <install-root> [--dry-run]\n" +
      "       node scripts/cleanup-retired-skills.js --validate",
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

  const validateFileMap = (fileMap, label) => {
    if (!fileMap || typeof fileMap !== "object" || Array.isArray(fileMap)) {
      throw new Error(`Invalid ${label} manifest section`);
    }
    const entries = Object.entries(fileMap);
    for (const [skill, knownFiles] of entries) {
      if (
        !isSafeRelative(skill) ||
        !Array.isArray(knownFiles) ||
        knownFiles.some((relative) => !isSafeRelative(relative))
      ) {
        throw new Error(`Invalid ${label} entry: ${skill}`);
      }
    }
    return entries;
  };
  const retiredSkills = validateFileMap(
    manifest.retired_skills,
    "retired skill",
  );
  const staleSkillFiles = validateFileMap(
    manifest.stale_skill_files,
    "stale skill file",
  );
  return { retiredSkills, staleSkillFiles };
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

function removeKnownFiles({ skillRoot, knownFiles, directories, dryRun }) {
  for (const relative of knownFiles) {
    const target = path.join(skillRoot, relative);
    collectKnownDirectories(skillRoot, relative, directories);
    if (hasSymlinkParent(skillRoot, target)) {
      console.log(`Preserving retired path through symlink: ${target}`);
      continue;
    }
    if (!fs.existsSync(target)) continue;

    const stat = fs.lstatSync(target);
    if (!stat.isFile() && !stat.isSymbolicLink()) {
      console.log(`Preserving non-file retired path: ${target}`);
      continue;
    }
    console.log(`${dryRun ? "[dry-run] " : ""}Remove retired file: ${target}`);
    if (!dryRun) fs.unlinkSync(target);
  }
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
  reportUnknown,
}) {
  const skillRoot = path.join(installRoot, "skills", skill);
  const directories = new Set(reportUnknown ? [skillRoot] : []);
  const knownFileSet = new Set(
    knownFiles.map((relative) => relative.split(/[\\/]/).join("/")),
  );
  if (fs.existsSync(skillRoot) && fs.lstatSync(skillRoot).isSymbolicLink()) {
    console.log(`Preserving symlinked retired skill: ${skillRoot}`);
    return;
  }

  removeKnownFiles({ skillRoot, knownFiles, directories, dryRun });
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
    return;
  }

  removeEmptyKnownDirectories(directories);
  if (reportUnknown && fs.existsSync(skillRoot)) {
    console.log(`Preserving unknown files in retired skill: ${skillRoot}`);
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
  const { retiredSkills, staleSkillFiles } = validateManifest(manifest);
  if (validateOnly) return 0;

  const installRoot = path.resolve(positional[0]);
  const skillsRoot = path.join(installRoot, "skills");
  if (fs.existsSync(skillsRoot) && fs.lstatSync(skillsRoot).isSymbolicLink()) {
    console.log(`Preserving symlinked skills root: ${skillsRoot}`);
    return 0;
  }

  for (const [skill, knownFiles] of retiredSkills) {
    cleanupSkill({
      installRoot,
      skill,
      knownFiles,
      dryRun,
      reportUnknown: true,
    });
  }
  for (const [skill, knownFiles] of staleSkillFiles) {
    cleanupSkill({
      installRoot,
      skill,
      knownFiles,
      dryRun,
      reportUnknown: false,
    });
  }
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
