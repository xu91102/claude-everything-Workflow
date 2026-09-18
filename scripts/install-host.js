#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { installRules, checkedPath, copyRule, digest } = require("./install-rules");
const { mergeSettings } = require("./merge-claude-settings.cjs");
const sourceRoot = path.resolve(__dirname, "..");
const observerCommand = 'node "$HOME/.claude/hooks/runtime/run-with-flags.js" post:observe "$HOME/.claude/skills/continuous-learning-v2/hooks/observe-v2.js" strict post';

function filesUnder(relative) {
  const absolute = path.join(sourceRoot, relative);
  if (fs.statSync(absolute).isDirectory()) {
    return fs.readdirSync(absolute).flatMap(name => filesUnder(`${relative}/${name}`));
  }
  return [relative];
}

function selectedFiles(host, optional = []) {
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "harness/manifest.json"), "utf8"));
  if (!["codex", "claude-code"].includes(host)) throw new Error(`Invalid host: ${host}`);
  for (const name of optional) {
    if (!Object.hasOwn(manifest.install.optional, name)) throw new Error(`Unknown optional skill: ${name}`);
  }
  const entries = [...manifest.install[host]];
  for (const skill of manifest.skills) {
    if (skill.compatibility.includes(host) && (skill.defaultInstall || optional.includes(skill.name))) {
      entries.push(path.posix.dirname(skill.path));
    }
  }
  for (const name of optional) entries.push(...manifest.install.optional[name]);
  return [...new Set(entries.flatMap(filesUnder))].sort();
}

function installHost({ host, installRoot, optional = [], dryRun = false, log = console.log, platform = process.platform }) {
  const root = path.resolve(installRoot);
  const hookRoot = platform === "win32" ? root : root.replace(/[\\$`"]/g, "\\$&");

  const files = selectedFiles(host, optional);
  const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, "legacy-install-hashes.json"), "utf8")).files;
  const ruleFiles = filesUnder("rules");
  const desired = new Set([...files, ...ruleFiles.map(f => host === "claude-code" && f.startsWith("rules/common/") ? `references/${f}` : f)]);
  if (host === "claude-code") desired.add("settings.json");
  // Preflight every planned write before changing the destination. Existing symlinks are never followed.
  for (const relative of desired) checkedPath(root, relative);
  const retired = [];
  for (const [relative, hashes] of Object.entries(legacy)) {
    if (desired.has(relative)) continue;
    let target;
    try { target = checkedPath(root, relative); }
    catch (error) { if (!/symlink/.test(error.message)) throw error; log(`Preserving excluded symlink: ${relative}`); continue; }
    if (!fs.existsSync(target)) continue;
    if (!fs.lstatSync(target).isFile()) { log(`Preserving non-file: ${target}`); continue; }
    const currentSource = path.join(sourceRoot, relative);
    const known = [...hashes];
    if (fs.existsSync(currentSource) && fs.statSync(currentSource).isFile()) known.push(digest(fs.readFileSync(currentSource)));
    if (known.includes(digest(fs.readFileSync(target)))) retired.push(target);
    else log(`Preserving modified/unknown file (may remain active): ${target}`);
  }
  for (const relative of files) copyRule({ source: path.join(sourceRoot, relative), root, relative, dryRun, log });
  installRules({ sourceRoot, installRoot: root, host, dryRun, log });
  if (host === "claude-code") {
    const target = checkedPath(root, "settings.json");
    const previous = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "{}";
    const existing = JSON.parse(previous.replace(/^\uFEFF/, ""));
    // Only retire our exact observer command; user hooks on the same event survive.
    for (const [event, entries] of Object.entries(existing.hooks || {})) {
      existing.hooks[event] = entries.map(entry => ({ ...entry, hooks: entry.hooks.filter(h =>
        h.command !== observerCommand && h.command !== observerCommand.replaceAll('$HOME/.claude', hookRoot)) })).filter(entry => entry.hooks.length);
    }
    const settings = JSON.parse(fs.readFileSync(path.join(sourceRoot, "settings.json"), "utf8"));
    if (optional.includes("continuous-learning-v2")) settings.hooks.PostToolUse.push({ matcher: "*", hooks: [{ type: "command", command: observerCommand, async: true, timeout: 10 }] });
    // Expand the source before deduplication, including custom --home installations.
    for (const config of [settings, existing]) {
      for (const entries of Object.values(config.hooks || {})) for (const entry of entries) for (const hook of entry.hooks) {
        if (hook.command) hook.command = hook.command.replaceAll('$HOME/.claude', hookRoot);
      }
    }
    const merged = mergeSettings(settings, existing);
    const content = JSON.stringify(merged, null, 2) + "\n";
    log(`${dryRun ? "[dry-run] " : ""}Merge Claude settings: ${target}`);
    if (!dryRun && content !== previous) {
      if (fs.existsSync(target)) fs.copyFileSync(target, checkedPath(root, `settings.json.bak.${digest(previous)}`));
      fs.writeFileSync(target, content, { mode: 0o600 });
    }
  }
  for (const target of retired) {
    log(`${dryRun ? "[dry-run] " : ""}Retire unchanged CEW file: ${target}`);
    if (!dryRun) fs.unlinkSync(target);
  }
  // Keep the older, explicit retired-skill migration for versions predating host profiles.
  const result = spawnSync(process.execPath, [path.join(__dirname, "cleanup-retired-skills.js"), root, ...(dryRun ? ["--dry-run"] : [])], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "Retired skill cleanup failed");
  if (result.stdout.trim()) log(result.stdout.trim());
}

function main(args) {
  let hosts = ["claude-code", "codex"], dryRun = false;
  const optional = [];
  let home = process.platform === "win32" ? process.env.USERPROFILE || process.env.HOME : process.env.HOME;
  let hostFlag;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") dryRun = true;
    else if (["--home", "--with-skill"].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      if (arg === "--home") home = value;
      else optional.push(value);
    }
    else if (["--codex-only", "--claude-only"].includes(arg)) {
      if (hostFlag && hostFlag !== arg) throw new Error("Host flags are mutually exclusive");
      hostFlag = arg; hosts = [arg === "--codex-only" ? "codex" : "claude-code"];
    } else if (["--help", "-h"].includes(arg)) {
      console.log("Usage: install [--codex-only|--claude-only] [--home DIR] [--with-skill handoff|continuous-learning-v2] [--dry-run]"); return;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!home) throw new Error("Install home is required");
  // Validate options for all hosts before the first write.
  for (const host of hosts) selectedFiles(host, optional);
  for (const host of hosts) installHost({ host, installRoot: path.join(home, host === "codex" ? ".codex" : ".claude"), optional, dryRun });
}
module.exports = { selectedFiles, installHost, main };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
