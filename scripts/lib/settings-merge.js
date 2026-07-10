"use strict";

const crypto = require("node:crypto");

const LEGACY_HOOK_PATTERNS = [
  "scripts/hooks/run-with-flags.js",
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

function stableObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableObject(value[key])]),
  );
}

function hookKey(hookDefinition) {
  const serialized = JSON.stringify(stableObject(hookDefinition));
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function isLegacyHook(hookDefinition) {
  if (!hookDefinition || typeof hookDefinition.command !== "string") {
    return false;
  }
  return LEGACY_HOOK_PATTERNS.some((pattern) =>
    hookDefinition.command.includes(pattern),
  );
}

function collectHookKeys(hooks) {
  const keys = [];
  for (const entries of Object.values(hooks || {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || !Array.isArray(entry.hooks)) continue;
      for (const hookDefinition of entry.hooks) {
        keys.push(hookKey(hookDefinition));
      }
    }
  }
  return keys;
}

function filterExistingEntries(entries, managedKeys) {
  if (!Array.isArray(entries)) return [];
  const filteredEntries = [];
  for (const entry of entries) {
    if (!entry || !Array.isArray(entry.hooks)) {
      filteredEntries.push(entry);
      continue;
    }
    const hooks = entry.hooks.filter((hookDefinition) => {
      if (isLegacyHook(hookDefinition)) return false;
      return !managedKeys.has(hookKey(hookDefinition));
    });
    if (hooks.length > 0) {
      filteredEntries.push({ ...entry, hooks });
    }
  }
  return filteredEntries;
}

function mergeHooks(existingHooks, sourceHooks, previousHookKeys) {
  const sourceKeys = collectHookKeys(sourceHooks);
  const managedKeys = new Set([...previousHookKeys, ...sourceKeys]);
  const eventTypes = new Set([
    ...Object.keys(existingHooks || {}),
    ...Object.keys(sourceHooks || {}),
  ]);
  const hooks = {};

  for (const eventType of eventTypes) {
    const existingEntries = filterExistingEntries(
      existingHooks && existingHooks[eventType],
      managedKeys,
    );
    const sourceEntries = Array.isArray(sourceHooks && sourceHooks[eventType])
      ? sourceHooks[eventType]
      : [];
    const mergedEntries = [...existingEntries, ...sourceEntries];
    if (mergedEntries.length > 0) {
      hooks[eventType] = mergedEntries;
    }
  }

  return { hooks, hookKeys: sourceKeys };
}

function mergeClaudeSettings(options) {
  const existing = options.existing || {};
  const source = options.source || {};
  const previousHookKeys = options.previousHookKeys || [];
  const hookResult = mergeHooks(
    existing.hooks,
    source.hooks,
    previousHookKeys,
  );
  const settings = {
    ...existing,
    ...source,
    env: {
      ...(source.env || {}),
      ...(existing.env || {}),
    },
    mcpServers: {
      ...(source.mcpServers || {}),
      ...(existing.mcpServers || {}),
    },
    hooks: hookResult.hooks,
  };

  return { settings, hookKeys: hookResult.hookKeys };
}

module.exports = {
  LEGACY_HOOK_PATTERNS,
  collectHookKeys,
  hookKey,
  isLegacyHook,
  mergeClaudeSettings,
};
