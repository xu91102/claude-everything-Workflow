#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const {
  BACKUP_ROOT_NAME,
  checkedPath,
  defaultBackupId,
  finalizeBackups,
  installRules,
  validateBackupId,
  validateRuleTargets,
} = require("./install-rules");

const PLUGIN_NAME = "claude-everything-workflow";
const PLUGIN_SUBPATH = path.posix.join(".gemini/config/plugins", PLUGIN_NAME);
const PLUGIN_HOME_REF = `~/.gemini/config/plugins/${PLUGIN_NAME}`;

const DEFAULT_ANTIGRAVITY_TOOLS = [
  "read_file",
  "edit_file",
  "write_file",
  "run_command",
  "manage_task",
  "search_web",
];

const TOOL_MAP = {
  Read: ["read_file"],
  Glob: ["read_file"],
  Grep: ["read_file"],
  Edit: ["edit_file"],
  MultiEdit: ["edit_file"],
  Write: ["write_file"],
  Bash: ["run_command", "manage_task"],
  WebSearch: ["search_web"],
  WebFetch: ["search_web"],
};

function lstatIfExists(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }
}

function assertNoSymlinkAncestors(homeDir) {
  const resolvedHome = path.resolve(homeDir);
  const chain = [
    ".gemini",
    ".gemini/config",
    ".gemini/config/plugins",
    PLUGIN_SUBPATH,
  ];
  for (const relative of chain) {
    const candidate = path.join(resolvedHome, relative);
    if (lstatIfExists(candidate)?.isSymbolicLink()) {
      throw new Error(`Refusing symlinked install path: ${candidate}`);
    }
  }
  return path.join(resolvedHome, PLUGIN_SUBPATH);
}

function unquoteScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return trimmed;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

function parseInlineArray(raw) {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  try {
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // Fallback for unquoted YAML flow sequences such as [Read, Edit].
  }
  return inner.split(",").map((item) => unquoteScalar(item)).filter(Boolean);
}

function parseBlockScalar(lines, startIndex, style) {
  const collected = [];
  let indent = null;
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      collected.push("");
      index += 1;
      continue;
    }
    const match = line.match(/^(\s+)/);
    if (!match) break;
    if (indent === null) indent = match[1].length;
    if (match[1].length < indent) break;
    collected.push(line.slice(indent));
    index += 1;
  }
  const joined = style.startsWith(">")
    ? collected.map((part) => part || "\n").join(" ").replace(/ \n /g, "\n")
    : collected.join("\n");
  return { value: joined.trim(), nextIndex: index };
}

function parseFrontmatter(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: null, body: normalized };

  const data = {};
  const lines = match[1].split("\n");
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      i += 1;
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) {
      i += 1;
      continue;
    }
    const key = kv[1];
    const rest = kv[2].trim();
    if (rest === "|" || rest === "|-" || rest === ">" || rest === ">-") {
      const block = parseBlockScalar(lines, i + 1, rest);
      data[key] = block.value;
      i = block.nextIndex;
      continue;
    }
    if (rest.startsWith("[") && rest.endsWith("]")) {
      data[key] = parseInlineArray(rest);
      i += 1;
      continue;
    }
    if (rest === "") {
      const items = [];
      let j = i + 1;
      while (j < lines.length) {
        const itemMatch = lines[j].match(/^\s*-\s+(.*)$/);
        if (!itemMatch) break;
        items.push(unquoteScalar(itemMatch[1]));
        j += 1;
      }
      data[key] = items.length > 0 ? items : "";
      i = j;
      continue;
    }
    data[key] = unquoteScalar(rest);
    i += 1;
  }
  return { data, body: match[2] };
}

function mapTools(rawTools, agentFile = "agent") {
  if (rawTools === undefined) {
    return [...DEFAULT_ANTIGRAVITY_TOOLS];
  }
  if (!Array.isArray(rawTools)) {
    throw new Error(`agents/${agentFile} declares invalid tools field`);
  }
  const mapped = [];
  const seen = new Set();
  for (const tool of rawTools) {
    const targets = TOOL_MAP[tool] || (DEFAULT_ANTIGRAVITY_TOOLS.includes(tool) ? [tool] : []);
    for (const target of targets) {
      if (!seen.has(target)) {
        seen.add(target);
        mapped.push(target);
      }
    }
  }
  if (mapped.length === 0) {
    throw new Error(`agents/${agentFile} declares no supported Antigravity tools`);
  }
  return mapped;
}

function normalizeRepoUrl(repo) {
  const raw = typeof repo === "string" ? repo : repo?.url;
  if (typeof raw !== "string" || !raw.trim()) {
    return "https://github.com/xu91102/claude-everything-Workflow";
  }
  return raw.replace(/^git\+/, "").replace(/\.git$/, "");
}

function buildPluginManifest(sourceRoot) {
  const pkg = JSON.parse(fs.readFileSync(path.join(sourceRoot, "package.json"), "utf8"));
  const repository = normalizeRepoUrl(pkg.repository);
  const manifest = {
    name: pkg.name || PLUGIN_NAME,
    displayName: "Claude Everything Workflow",
    version: pkg.version,
    description:
      "Evidence-based engineering workflows for Antigravity: implement, debug, review, verify, and PR gates.",
    author: { name: "xu91102" },
    homepage: pkg.homepage || repository,
    repository,
    suggestedPrompts: [
      "按 CEW 流程排查并修复这个 bug，输出验证证据",
      "对当前分支改动做代码审查并给出分级问题清单",
      "为这个需求起草正式工程 Spec 并等我审批",
    ],
  };
  return JSON.stringify(manifest, null, 2) + "\n";
}

function writeManagedFile({ pluginRoot, relative, content, mode, backupId, dryRun, log }) {
  const target = checkedPath(pluginRoot, relative);
  const next = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const existingStat = lstatIfExists(target);
  if (existingStat) {
    if (existingStat.isSymbolicLink()) throw new Error(`Refusing symlink: ${target}`);
    const previous = fs.readFileSync(target);
    if (next.equals(previous)) return;
    if (backupId) {
      const backup = checkedPath(pluginRoot, path.posix.join(BACKUP_ROOT_NAME, backupId, relative));
      log(`${dryRun ? "[dry-run] " : ""}备份文件: ${backup}`);
      if (!dryRun) {
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        fs.copyFileSync(target, backup);
      }
    }
  }
  if (!dryRun) {
    const writableMode = mode !== undefined ? (mode & 0o777) | 0o200 : undefined;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp-${crypto.randomUUID()}`;
    try {
      fs.writeFileSync(temp, next, {
        flag: "wx",
        ...(writableMode !== undefined ? { mode: writableMode } : {}),
      });
      if (process.platform !== "win32" && writableMode !== undefined) {
        fs.chmodSync(temp, writableMode);
      }
      fs.renameSync(temp, target);
    } finally {
      fs.rmSync(temp, { force: true });
    }
  } else {
    log(`[dry-run] 写入文件: ${target}`);
  }
}

function collectDirectoryFiles(sourceDir, relativePrefix = "") {
  const entries = [];
  if (!fs.existsSync(sourceDir)) return entries;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const srcPath = path.join(sourceDir, entry.name);
    const relPath = relativePrefix ? path.posix.join(relativePrefix, entry.name) : entry.name;
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing symlink in source directory: ${srcPath}`);
    }
    if (entry.isDirectory()) {
      entries.push(...collectDirectoryFiles(srcPath, relPath));
    } else if (entry.isFile()) {
      entries.push({ srcPath, relPath, mode: fs.statSync(srcPath).mode & 0o777 });
    }
  }
  return entries;
}

function buildCommandSkills(sourceRoot) {
  const commandsDir = path.join(sourceRoot, "commands");
  if (!fs.existsSync(commandsDir)) return [];
  const generated = [];
  for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const cmdName = entry.name.slice(0, -3);
    if (fs.existsSync(path.join(sourceRoot, "skills", cmdName, "SKILL.md"))) {
      continue;
    }
    const raw = fs.readFileSync(path.join(commandsDir, entry.name), "utf8");
    const { data, body } = parseFrontmatter(raw);
    if (!data || typeof data.description !== "string" || !data.description.trim()) {
      throw new Error(`commands/${entry.name} missing frontmatter description`);
    }
    const updatedBody = body
      .replace(/\$ARGUMENTS/g, "用户本次请求的内容和参数")
      .replace(/^\n+/, "");
    const content = `---\nname: ${cmdName}\ndescription: ${JSON.stringify(data.description)}\n---\n\n${updatedBody}`;
    generated.push({ relative: path.posix.join("skills", cmdName, "SKILL.md"), content });
  }
  return generated;
}

function buildAgentFiles(sourceRoot) {
  const agentsDir = path.join(sourceRoot, "agents");
  if (!fs.existsSync(agentsDir)) return [];
  const generated = [];
  for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(agentsDir, entry.name), "utf8");
    const { data, body } = parseFrontmatter(raw);
    if (
      !data ||
      typeof data.name !== "string" ||
      !data.name.trim() ||
      typeof data.description !== "string" ||
      !data.description.trim()
    ) {
      throw new Error(`agents/${entry.name} missing name or description`);
    }
    const tools = mapTools(data.tools, entry.name);
    const updatedBody = body
      .replace(/`(skills\/[^`\s]+)`/g, (_, target) => `\`${PLUGIN_HOME_REF}/${target}\``)
      .replace(/`(references\/agents\/[^`\s]+)`/g, (_, target) => `\`${PLUGIN_HOME_REF}/${target}\``)
      .replace(/^\n+/, "");
    const frontmatter = [
      `name: ${data.name}`,
      `description: ${JSON.stringify(data.description)}`,
      "subagent: true",
      "mainAgent: false",
      `tools: [${tools.join(", ")}]`,
    ].join("\n");
    generated.push({
      relative: path.posix.join("agents", entry.name),
      content: `---\n${frontmatter}\n---\n\n${updatedBody}`,
    });
  }
  return generated;
}

function runRetiredSkillCleanup(sourceRoot, pluginRoot, dryRun, log) {
  const script = path.join(sourceRoot, "scripts/cleanup-retired-skills.js");
  const args = [script, pluginRoot];
  if (dryRun) args.push("--dry-run");
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.stdout) {
    for (const line of result.stdout.trimEnd().split(/\r?\n/)) {
      if (line) log(line);
    }
  }
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `Retired skill cleanup exited ${result.status}`);
  }
}

function installAntigravity({
  sourceRoot,
  homeDir,
  backupId = defaultBackupId(),
  dryRun = false,
  log = console.log,
}) {
  const pluginRoot = assertNoSymlinkAncestors(homeDir);
  log(`${dryRun ? "[dry-run] " : ""}Installing Antigravity plugin to ${pluginRoot}`);

  const refFiles = collectDirectoryFiles(path.join(sourceRoot, "references"), "references");
  const skillFiles = collectDirectoryFiles(path.join(sourceRoot, "skills"), "skills")
    .filter((item) => item.relPath !== "skills/README.md");
  const learningFiles = collectDirectoryFiles(
    path.join(sourceRoot, "scripts/learning"),
    "scripts/learning",
  );
  const commandSkills = buildCommandSkills(sourceRoot);
  const agentFiles = buildAgentFiles(sourceRoot);

  const managedPaths = [
    BACKUP_ROOT_NAME,
    "plugin.json",
    "rules/AGENTS.md",
    "harness/manifest.json",
    ...refFiles.map((item) => item.relPath),
    ...skillFiles.map((item) => item.relPath),
    ...learningFiles.map((item) => item.relPath),
    ...commandSkills.map((item) => item.relative),
    ...agentFiles.map((item) => item.relative),
  ];

  // Validate every target before the first write; checkedPath refuses symlinks.
  for (const relative of managedPaths) {
    checkedPath(pluginRoot, relative);
  }
  validateRuleTargets({ sourceRoot, installRoot: pluginRoot, host: "antigravity" });

  validateBackupId(backupId);
  if (!dryRun) {
    fs.mkdirSync(pluginRoot, { recursive: true });
  }

  writeManagedFile({
    pluginRoot,
    relative: "plugin.json",
    content: buildPluginManifest(sourceRoot),
    backupId,
    dryRun,
    log,
  });
  writeManagedFile({
    pluginRoot,
    relative: "rules/AGENTS.md",
    content: fs.readFileSync(path.join(sourceRoot, "AGENTS.md")),
    backupId,
    dryRun,
    log,
  });
  writeManagedFile({
    pluginRoot,
    relative: "harness/manifest.json",
    content: fs.readFileSync(path.join(sourceRoot, "harness/manifest.json")),
    dryRun,
    log,
  });

  for (const item of [...refFiles, ...skillFiles, ...learningFiles]) {
    writeManagedFile({
      pluginRoot,
      relative: item.relPath,
      content: fs.readFileSync(item.srcPath),
      mode: item.mode,
      dryRun,
      log,
    });
  }
  for (const item of [...commandSkills, ...agentFiles]) {
    writeManagedFile({
      pluginRoot,
      relative: item.relative,
      content: item.content,
      dryRun,
      log,
    });
  }

  installRules({
    sourceRoot,
    installRoot: pluginRoot,
    host: "antigravity",
    backupId,
    dryRun,
    log,
  });

  runRetiredSkillCleanup(sourceRoot, pluginRoot, dryRun, log);
  finalizeBackups({ installRoot: pluginRoot, dryRun, log });

  const legacyAgents = path.join(path.resolve(homeDir), ".gemini/AGENTS.md");
  if (lstatIfExists(legacyAgents)) {
    log(`提示: 检测到 ${legacyAgents}，若为旧版配置可能与插件 rules/AGENTS.md 冲突；请按需手动备份后移除。`);
  }

  return pluginRoot;
}

module.exports = { PLUGIN_SUBPATH, installAntigravity, parseFrontmatter, mapTools };

function parseCli(argv) {
  let dryRun = false;
  let backupId;
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--backup-id") {
      backupId = validateBackupId(argv[++i]);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  return { dryRun, backupId, positional };
}

if (require.main === module) {
  try {
    const { dryRun, backupId, positional } = parseCli(process.argv.slice(2));
    if (positional.length !== 1 || !positional[0]) {
      throw new Error("Usage: install-antigravity.js <home-dir> [--backup-id <id>] [--dry-run]");
    }
    installAntigravity({
      sourceRoot: path.resolve(__dirname, ".."),
      homeDir: positional[0],
      backupId: backupId || defaultBackupId(),
      dryRun,
    });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
