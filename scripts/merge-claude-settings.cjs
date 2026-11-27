"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const RUNNER = "hooks/runtime/run-with-flags.js";
const LEGACY_RUNNER = "scripts/hooks/run-with-flags.js";
const HOME_PREFIX = "$HOME/.claude";

const LEGACY_HOOK_PATTERNS = [
  LEGACY_RUNNER,
  "scripts/hooks/commit-quality.js",
  "scripts/hooks/session-start.js",
  "scripts/hooks/session-end.js",
  "scripts/lib/hook-flags.js",
  "scripts/lib/utils.js",
  "hooks/observe.js",
  "hooks/review-confidence.js",
  "hooks/session-start.js",
  "hooks/session-end.js",
  "hooks/evaluate-session.js",
  "hooks/pre-compact.js",
  "hooks/runtime/session-utils.js",
];
const LEGACY_WRAPPED_TARGETS = new Map([
  ["session:start", ["scripts/hooks/session-start.js", "hooks/session-start.js"]],
  ["session:end", ["scripts/hooks/session-end.js", "hooks/session-end.js"]],
  ["stop:evaluate-session", ["hooks/evaluate-session.js"]],
  ["precompact:save-context", ["hooks/pre-compact.js"]],
  ["post:observe", ["hooks/observe.js"]],
  ["post:write:console-log", ["hooks/check-console-log.js"]],
  ["post:multiedit:console-log", ["hooks/check-console-log.js"]],
]);

function installedPath(script, installRoot) {
  if (!script) return undefined;
  const prefix = [HOME_PREFIX, installRoot.replace(/\\/g, "/")].find((prefix) =>
    process.platform === "win32"
      ? script.toLowerCase().startsWith(`${prefix.toLowerCase()}/`)
      : script.startsWith(`${prefix}/`));
  return prefix ? script.slice(prefix.length + 1) : undefined;
}

function hookCommand(hook, installRoot) {
  const match = hook?.type === "command" && typeof hook.command === "string" &&
    /^\s*node\s+(?:"([^"]+)"|'([^']+)'|(\S+))(?:\s+(\S+)\s+(?:"([^"]+)"|'([^']+)'|(\S+)))?/i.exec(hook.command);
  if (!match) return {};
  const executable = (match[1] ?? match[2] ?? match[3]).replace(/\\/g, "/");
  const target = (match[5] ?? match[6] ?? match[7])?.replace(/\\/g, "/");
  const relativeLegacyRunner = executable === LEGACY_RUNNER;
  return {
    script: installedPath(executable, installRoot),
    id: match[4],
    target: relativeLegacyRunner ? target : installedPath(target, installRoot),
    relativeLegacyRunner,
  };
}

function validateHookGroups(events) {
  for (const [event, groups] of Object.entries(events)) {
    if (!Array.isArray(groups) || groups.some((group) => !Array.isArray(group?.hooks))) {
      throw new Error(`Invalid Claude settings hook groups for ${event}`);
    }
  }
}

function mergeHookGroups(current, incoming, installRoot, windowsPaths) {
  const managedTargets = new Map();
  const managedGroups = incoming.map((group) => {
    const hooks = group.hooks.filter((hook) => {
      const command = hookCommand(hook, installRoot);
      if (command.script !== RUNNER || !command.id) return true;
      if (managedTargets.has(command.id)) return false;
      managedTargets.set(command.id, command.target);
      return true;
    }).map((hook) => windowsPaths && hook?.type === "command"
      ? { ...hook, command: hook.command.replaceAll(HOME_PREFIX, () => installRoot) }
      : hook);
    return { ...group, hooks };
  });
  const userGroups = current.map((group) => ({
    ...group,
    hooks: group.hooks.filter((hook) => {
      const { script, id, target, relativeLegacyRunner } = hookCommand(hook, installRoot);
      if (LEGACY_HOOK_PATTERNS.includes(script)) return false;
      if (!relativeLegacyRunner && script !== RUNNER) return true;
      if (LEGACY_WRAPPED_TARGETS.get(id)?.includes(target)) return false;
      return !target || managedTargets.get(id) !== target;
    }),
  }));
  return [...userGroups, ...managedGroups].filter((group) => group.hooks.length > 0);
}

function mergeSettings(source, existing, { installRoot = path.join(os.homedir(), ".claude"), windowsPaths = false } = {}) {
  const current = existing.hooks || {};
  const incoming = source.hooks || {};
  validateHookGroups(current);
  validateHookGroups(incoming);
  const hooks = Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(incoming)])]
    .map((event) => [event, mergeHookGroups(
      Object.hasOwn(current, event) ? current[event] : [],
      Object.hasOwn(incoming, event) ? incoming[event] : [],
      installRoot,
      windowsPaths,
    )])
    .filter(([, groups]) => groups.length > 0));
  return {
    ...existing,
    ...source,
    env: { ...(source.env || {}), ...(existing.env || {}) },
    mcpServers: { ...(source.mcpServers || {}), ...(existing.mcpServers || {}) },
    hooks,
  };
}

function readJson(path) {
  const raw = fs.readFileSync(path, "utf8");
  // strip BOM (﻿) if present
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}

function main() {
  const [, , sourcePath, destinationPath, mode] = process.argv;
  const source = readJson(sourcePath);
  const existing = fs.existsSync(destinationPath)
    ? readJson(destinationPath)
    : {};
  const merged = mergeSettings(source, existing, {
    installRoot: path.dirname(path.resolve(destinationPath)),
    windowsPaths: mode === "--windows-paths",
  });
  fs.writeFileSync(destinationPath, JSON.stringify(merged, null, 2) + "\n");
}

if (require.main === module) main();

module.exports = { mergeSettings };
