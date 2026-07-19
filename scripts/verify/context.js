"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");
const errors = [];
const warnings = [];

function rel(...parts) {
  return path.join(root, ...parts);
}

function exists(file) {
  return fs.existsSync(rel(file));
}

function read(file) {
  return fs.readFileSync(rel(file), "utf8");
}

function walk(dir = "") {
  const base = rel(dir);
  if (!fs.existsSync(base)) return [];

  const out = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;

    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(child));
    } else {
      out.push(child.replace(/\\/g, "/"));
    }
  }
  return out;
}

function managedFiles() {
  const roots = [
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "settings.json",
    "commands",
    "agents",
    "skills/continuous-learning-v2",
    "skills/README.md",
    "skills/test-driven-development",
    "skills/e2e-testing",
    "skills/iterative-retrieval",
    "skills/using-superpowers",
    "skills/subagent-driven-development",
    "skills/brainstorming",
    "skills/using-git-worktrees",
    "skills/executing-plans",
    "skills/writing-plans",
    "skills/systematic-debugging",
    "skills/verification-before-completion",
    "skills/learn",
    "hooks",
    "scripts",
    "rules",
  ];

  return roots.flatMap((item) => {
    const full = rel(item);
    if (!fs.existsSync(full)) return [];

    if (fs.statSync(full).isDirectory()) return walk(item);
    return [item];
  });
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function isVerifierImplementation(file) {
  return file === "scripts/verify-harness.js" || file.startsWith("scripts/verify/");
}

function requireTokens(file, tokens) {
  if (!exists(file)) {
    fail(`${file} is missing`);
    return;
  }

  const body = read(file);
  for (const token of tokens) {
    if (!body.includes(token)) {
      fail(`${file} should include ${token}`);
    }
  }
}
module.exports = {
  errors,
  exists,
  fail,
  fs,
  isVerifierImplementation,
  managedFiles,
  path,
  read,
  rel,
  requireTokens,
  root,
  spawnSync,
  warn,
  warnings,
};
