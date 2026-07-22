"use strict";

const fs = require("fs");

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

function isLegacyHook(hookDefinition) {
  if (typeof hookDefinition !== "object" || !hookDefinition.command) return false;
  return LEGACY_HOOK_PATTERNS.some((pattern) => hookDefinition.command.includes(pattern));
}

function filterHooks(entries) {
  if (!Array.isArray(entries)) return entries;
  return entries
    .map((entry) => {
      if (!entry || !Array.isArray(entry.hooks)) return entry;
      const hooks = entry.hooks.filter((hook) => !isLegacyHook(hook));
      return { ...entry, hooks };
    })
    .filter((entry) => entry.hooks && entry.hooks.length > 0);
}

function cleanHooks(hooks) {
  if (!hooks || typeof hooks !== "object") return hooks;
  const cleaned = {};
  for (const [eventType, entries] of Object.entries(hooks)) {
    const filtered = filterHooks(entries);
    if (filtered.length > 0) cleaned[eventType] = filtered;
  }
  return cleaned;
}

function mergeSettings(source, existing) {
  return {
    ...existing,
    ...source,
    env: { ...(source.env || {}), ...(existing.env || {}) },
    mcpServers: { ...(source.mcpServers || {}), ...(existing.mcpServers || {}) },
    hooks: cleanHooks({ ...(existing.hooks || {}), ...(source.hooks || {}) }),
  };
}

function main() {
  const [, , sourcePath, destinationPath] = process.argv;
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const existing = fs.existsSync(destinationPath)
    ? JSON.parse(fs.readFileSync(destinationPath, "utf8"))
    : {};
  const merged = mergeSettings(source, existing);
  fs.writeFileSync(destinationPath, JSON.stringify(merged, null, 2) + "\n");
}

if (require.main === module) main();

module.exports = { cleanHooks, mergeSettings };
