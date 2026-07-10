"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { mergeClaudeSettings } = require("./settings-merge");

const MANIFEST_NAME = ".cew-manifest.json";
const SHARED_DIRS = [
  "rules",
  "agents",
  "commands",
  "scripts",
  "hooks",
  "skills",
  "homunculus",
  "references",
];
const PACKAGE_ONLY_PATHS = new Set([
  "scripts/install.sh",
  "scripts/install.ps1",
  "scripts/install-manager.js",
]);
const PACKAGE_ONLY_PREFIXES = ["scripts/lib/", "scripts/tests/"];
const CORE_SKILLS = new Set([
  "brainstorming",
  "executing-plans",
  "subagent-driven-development",
  "systematic-debugging",
  "test-driven-development",
  "using-git-worktrees",
  "using-superpowers",
  "verification-before-completion",
  "writing-plans",
]);
const PROFILES = new Set(["core", "coding", "full"]);
const LEGACY_FILES = [
  "scripts/install.sh",
  "scripts/install.ps1",
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
const LEGACY_DIRECTORIES = ["skills/skill-creator"];

function defaultOutput(line) {
  process.stdout.write(`${line}\n`);
}

function normalizeRelative(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function hashBuffer(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function hashFile(filePath) {
  return hashBuffer(fs.readFileSync(filePath));
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`无法解析 JSON 文件 ${filePath}: ${error.message}`, {
      cause: error,
    });
  }
}

function readManifest(destination) {
  const manifest = readJson(path.join(destination, MANIFEST_NAME), null);
  if (!manifest || manifest.schemaVersion !== 1) return null;
  return manifest;
}

function isPackageOnly(relativePath) {
  if (PACKAGE_ONLY_PATHS.has(relativePath)) return true;
  return PACKAGE_ONLY_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function isIncludedByProfile(relativePath, profile) {
  if (profile === "full") return true;
  if (relativePath.startsWith("homunculus/")) return false;
  if (relativePath.startsWith("references/")) return false;
  if (profile === "coding") return true;
  if (relativePath.startsWith("agents/")) return false;
  if (relativePath.startsWith("commands/")) return false;
  if (!relativePath.startsWith("skills/")) return true;
  if (relativePath === "skills/README.md") return true;
  const skillName = relativePath.split("/")[1];
  return CORE_SKILLS.has(skillName);
}

function listFiles(directory, rootDirectory = directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(absolutePath, rootDirectory));
      continue;
    }
    if (!entry.isFile()) continue;
    files.push(normalizeRelative(path.relative(rootDirectory, absolutePath)));
  }
  return files;
}

function settingsForProfile(source, profile) {
  if (profile !== "core") return source;
  const hooks = {};
  for (const [eventType, entries] of Object.entries(source.hooks || {})) {
    const filteredEntries = [];
    for (const entry of entries) {
      const hookDefinitions = (entry.hooks || []).filter((hookDefinition) => {
        if (typeof hookDefinition.command !== "string") return true;
        return !hookDefinition.command.includes("skills/continuous-learning-v2/");
      });
      if (hookDefinitions.length > 0) {
        filteredEntries.push({ ...entry, hooks: hookDefinitions });
      }
    }
    if (filteredEntries.length > 0) hooks[eventType] = filteredEntries;
  }
  return { ...source, hooks };
}

function rootFilesForTarget(target) {
  return target === "claude" ? ["AGENTS.md", "CLAUDE.md"] : ["AGENTS.md"];
}

function resolveManagedPath(destination, relativePath) {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) {
    throw new Error(`manifest 包含非法路径：${String(relativePath)}`);
  }
  const normalized = relativePath.replace(/\\/g, "/");
  const resolvedRoot = path.resolve(destination);
  const resolved = path.resolve(resolvedRoot, normalized);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`manifest 路径越界：${relativePath}`);
  }
  return resolved;
}

function sourceFiles(rootDir, target, profile) {
  const candidates = [...rootFilesForTarget(target)];
  for (const directory of SHARED_DIRS) {
    candidates.push(...listFiles(path.join(rootDir, directory), rootDir));
  }
  return candidates
    .filter((relativePath) => !isPackageOnly(relativePath))
    .filter((relativePath) => isIncludedByProfile(relativePath, profile))
    .filter((relativePath) => fs.existsSync(path.join(rootDir, relativePath)))
    .sort();
}

function backupPath(filePath) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  let candidate = `${filePath}.bak.${stamp}`;
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = `${filePath}.bak.${stamp}.${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function backupFile(filePath, options) {
  const backup = backupPath(filePath);
  options.output(`备份：${filePath} -> ${backup}`);
  if (!options.dryRun) {
    fs.copyFileSync(filePath, backup);
  }
}

function copyManagedFile(sourcePath, destinationPath, previousHash, options) {
  const content = fs.readFileSync(sourcePath);
  const nextHash = hashBuffer(content);
  if (fs.existsSync(destinationPath)) {
    const currentHash = hashFile(destinationPath);
    if (currentHash === nextHash) return nextHash;
    if (!previousHash || currentHash !== previousHash) {
      backupFile(destinationPath, options);
    }
  }
  options.output(`${options.dryRun ? "[dry-run] " : ""}写入：${destinationPath}`);
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.writeFileSync(destinationPath, content);
    const mode = fs.statSync(sourcePath).mode & 0o777;
    fs.chmodSync(destinationPath, mode);
  }
  return nextHash;
}

function removeEmptyParents(startDirectory, destination) {
  let current = startDirectory;
  while (current.startsWith(destination) && current !== destination) {
    if (!fs.existsSync(current) || fs.readdirSync(current).length > 0) return;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

function managedBackupPath(destination, relativePath) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const backupRoot = path.join(destination, ".cew-backups", stamp);
  let backup = resolveManagedPath(backupRoot, relativePath);
  let suffix = 1;
  while (fs.existsSync(backup)) {
    backup = `${resolveManagedPath(backupRoot, relativePath)}.${suffix}`;
    suffix += 1;
  }
  return backup;
}

function moveManagedPathToBackup(destination, relativePath, label, options) {
  const targetPath = resolveManagedPath(destination, relativePath);
  if (!fs.existsSync(targetPath)) return;
  const backup = managedBackupPath(destination, relativePath);
  options.output(`${label}：${targetPath} -> ${backup}`);
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.renameSync(targetPath, backup);
    removeEmptyParents(path.dirname(targetPath), destination);
  }
}

function migrateLegacyPath(destination, relativePath, options) {
  moveManagedPathToBackup(destination, relativePath, "迁移旧版路径", options);
}

function migrateLegacyPaths(destination, options) {
  for (const relativePath of LEGACY_FILES) {
    migrateLegacyPath(destination, relativePath, options);
  }
  for (const relativePath of LEGACY_DIRECTORIES) {
    migrateLegacyPath(destination, relativePath, options);
  }
}

function removeObsoleteFiles(destination, previousFiles, currentPaths, options) {
  for (const previousFile of previousFiles) {
    if (currentPaths.has(previousFile.path)) continue;
    const destinationPath = resolveManagedPath(destination, previousFile.path);
    if (!fs.existsSync(destinationPath)) continue;
    if (hashFile(destinationPath) !== previousFile.hash) {
      moveManagedPathToBackup(
        destination,
        previousFile.path,
        "迁移已修改的废弃受管文件",
        options,
      );
      continue;
    }
    options.output(`${options.dryRun ? "[dry-run] " : ""}删除废弃受管文件：${destinationPath}`);
    if (!options.dryRun) {
      fs.unlinkSync(destinationPath);
      removeEmptyParents(path.dirname(destinationPath), destination);
    }
  }
}

function writeJsonIfChanged(filePath, value, options) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === content) {
    return;
  }
  options.output(`${options.dryRun ? "[dry-run] " : ""}写入：${filePath}`);
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

function mergeSettings(rootDir, destination, previousManifest, options) {
  const sourcePath = path.join(rootDir, "settings.json");
  const destinationPath = path.join(destination, "settings.json");
  const source = settingsForProfile(readJson(sourcePath, {}), options.profile);
  const existing = readJson(destinationPath, {});
  const result = mergeClaudeSettings({
    source,
    existing,
    previousHookKeys: previousManifest ? previousManifest.hookKeys || [] : [],
  });
  const nextContent = `${JSON.stringify(result.settings, null, 2)}\n`;
  const currentContent = fs.existsSync(destinationPath)
    ? fs.readFileSync(destinationPath, "utf8")
    : null;
  if (currentContent !== nextContent) {
    if (currentContent !== null) backupFile(destinationPath, options);
    writeJsonIfChanged(destinationPath, result.settings, options);
    if (!options.dryRun) fs.chmodSync(destinationPath, 0o600);
  }
  return result.hookKeys;
}

function packageVersion(rootDir) {
  const packageJson = readJson(path.join(rootDir, "package.json"), {});
  return typeof packageJson.version === "string" ? packageJson.version : "unknown";
}

function installTarget(rootDir, homeDir, target, profile, options) {
  const destination = path.join(homeDir, target === "claude" ? ".claude" : ".codex");
  options.output(`安装 ${target === "claude" ? "Claude" : "Codex"} Workflow：${destination}`);
  const previousManifest = readManifest(destination);
  if (target === "claude") {
    readJson(path.join(rootDir, "settings.json"), {});
    readJson(path.join(destination, "settings.json"), {});
  }
  migrateLegacyPaths(destination, options);
  const previousFiles = previousManifest ? previousManifest.files || [] : [];
  const previousByPath = new Map(previousFiles.map((file) => [file.path, file.hash]));
  const relativePaths = sourceFiles(rootDir, target, profile);
  const files = relativePaths.map((relativePath) => {
    const hash = copyManagedFile(
      path.join(rootDir, relativePath),
      resolveManagedPath(destination, relativePath),
      previousByPath.get(relativePath),
      options,
    );
    return { path: relativePath, hash };
  });
  const currentPaths = new Set(relativePaths);
  removeObsoleteFiles(destination, previousFiles, currentPaths, options);
  const hookKeys = target === "claude"
    ? mergeSettings(rootDir, destination, previousManifest, options)
    : [];
  const manifest = {
    schemaVersion: 1,
    package: "claude-everything-workflow",
    version: packageVersion(rootDir),
    target,
    profile,
    files,
    hookKeys,
  };
  writeJsonIfChanged(path.join(destination, MANIFEST_NAME), manifest, options);
}

function installWorkflow(options) {
  const profile = options.profile || "full";
  if (!PROFILES.has(profile)) {
    throw new Error(`未知 profile：${profile}；可选值为 core、coding、full`);
  }
  const targets = options.targets || ["claude", "codex"];
  const runtimeOptions = {
    dryRun: Boolean(options.dryRun),
    output: options.output || defaultOutput,
    profile,
  };
  for (const target of targets) {
    if (target !== "claude" && target !== "codex") {
      throw new Error(`未知安装目标：${target}`);
    }
    installTarget(
      path.resolve(options.rootDir),
      path.resolve(options.homeDir),
      target,
      profile,
      runtimeOptions,
    );
  }
}

function inspectManagedFiles(destination, manifest) {
  const missing = [];
  const modified = [];
  for (const file of manifest.files || []) {
    const filePath = resolveManagedPath(destination, file.path);
    if (!fs.existsSync(filePath)) {
      missing.push(file.path);
      continue;
    }
    if (hashFile(filePath) !== file.hash) {
      modified.push(file.path);
    }
  }
  return { missing, modified };
}

function doctorWorkflow(options) {
  const targets = options.targets || ["claude", "codex"];
  const output = options.output || defaultOutput;
  const reports = [];
  for (const target of targets) {
    const destination = path.join(
      path.resolve(options.homeDir),
      target === "claude" ? ".claude" : ".codex",
    );
    const manifest = readManifest(destination);
    if (!manifest) {
      output(`未发现 ${target} 的 ${MANIFEST_NAME}，需要重新安装以启用受管更新。`);
      reports.push({ target, installed: false, missing: [], modified: [] });
      continue;
    }
    const drift = inspectManagedFiles(destination, manifest);
    output(
      `${target}: version=${manifest.version} profile=${manifest.profile} ` +
        `files=${(manifest.files || []).length}`,
    );
    if (drift.missing.length > 0) {
      output(`  缺失：${drift.missing.join(", ")}`);
    }
    if (drift.modified.length > 0) {
      output(`  已修改：${drift.modified.join(", ")}`);
    }
    reports.push({ target, installed: true, ...drift });
  }
  return reports;
}

module.exports = {
  MANIFEST_NAME,
  PROFILES,
  doctorWorkflow,
  installWorkflow,
  isIncludedByProfile,
  readManifest,
  sourceFiles,
};
