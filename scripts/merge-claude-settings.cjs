"use strict";

const fs = require("fs");

const path = require("node:path");
const LEGACY_HOOK_COMMANDS = require("./legacy-hook-commands.json").commands;

function isLegacyHook(hookDefinition, installRoot) {
  if (hookDefinition?.type !== "command" || typeof hookDefinition.command !== "string") return false;
  // Exact historical command plus a CEW install root: suffixes and relative paths prove no ownership.
  const roots = ["$HOME/.claude", "~/.claude"];
  if (installRoot) {
    roots.push(installRoot, installRoot.replace(/[\\$`"]/g, "\\$&"));
  }
  return LEGACY_HOOK_COMMANDS.some(({ command }) => roots.some(root =>
    hookDefinition.command === command.replaceAll("$HOME/.claude", root)));
}

function filterHooks(entries, installRoot) {
  if (!Array.isArray(entries)) return entries;
  return entries
    .map((entry) => {
      if (!entry || !Array.isArray(entry.hooks)) return entry;
      const hooks = entry.hooks.filter((hook) => !isLegacyHook(hook, installRoot));
      return { ...entry, hooks };
    })
    .filter((entry) => entry.hooks && entry.hooks.length > 0);
}

function cleanHooks(hooks, installRoot) {
  if (!hooks || typeof hooks !== "object") return hooks;
  const cleaned = {};
  for (const [eventType, entries] of Object.entries(hooks)) {
    const filtered = filterHooks(entries, installRoot);
    if (filtered.length > 0) cleaned[eventType] = filtered;
  }
  return cleaned;
}

function mergeSettings(source, existing, { installRoot } = {}) {
  const hooks = cleanHooks(existing.hooks || {}, installRoot);
  for (const [event, entries] of Object.entries(source.hooks || {})) {
    const combined = [...(hooks[event] || [])];
    for (const entry of entries) {
      const target = combined.find(item => item.matcher === entry.matcher);
      if (!target) combined.push(entry);
      else for (const hook of entry.hooks) {
        const index = target.hooks.findIndex(item => item.command === hook.command);
        if (index < 0) target.hooks.push(hook);
        else target.hooks[index] = hook;
      }
    }
    hooks[event] = combined;
  }
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
  const [, , sourcePath, destinationPath] = process.argv;
  const source = readJson(sourcePath);
  const existing = fs.existsSync(destinationPath)
    ? readJson(destinationPath)
    : {};
  const merged = mergeSettings(source, existing, { installRoot: path.dirname(path.resolve(destinationPath)) });
  fs.writeFileSync(destinationPath, JSON.stringify(merged, null, 2) + "\n");
}

if (require.main === module) main();

module.exports = { cleanHooks, mergeSettings };
