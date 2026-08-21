"use strict";

const fs = require("fs");
const path = require("path");

const MANAGED_ROOTS = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "settings.json",
  "commands",
  "agents",
  "skills",
  "hooks",
  "scripts",
  "rules",
  "templates",
];

function createFileAccess(root) {
  const rel = (...parts) => path.join(root, ...parts);
  const exists = (file) => fs.existsSync(rel(file));
  const read = (file) => fs.readFileSync(rel(file), "utf8");

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

  return { rel, exists, read, walk };
}

function createManagedFiles({ rel, walk }) {
  return () => MANAGED_ROOTS.flatMap((item) => {
    const full = rel(item);
    if (!fs.existsSync(full)) return [];
    if (fs.statSync(full).isDirectory()) return walk(item);
    return [item];
  });
}

function createTokenChecker({ exists, read, fail }) {
  return (file, tokens) => {
    if (!exists(file)) {
      fail(`${file} is missing`);
      return;
    }

    const body = read(file);
    for (const token of tokens) {
      if (!body.includes(token)) fail(`${file} should include ${token}`);
    }
  };
}

function isVerifierImplementation(file) {
  return file === "scripts/verify-harness.js" || file.startsWith("scripts/verify/");
}

function createHarnessContext(root) {
  const errors = [];
  const warnings = [];
  const fileAccess = createFileAccess(root);
  const fail = (message) => errors.push(message);
  const warn = (message) => warnings.push(message);

  return {
    root,
    errors,
    warnings,
    ...fileAccess,
    managedFiles: createManagedFiles(fileAccess),
    fail,
    warn,
    requireTokens: createTokenChecker({ ...fileAccess, fail }),
    isVerifierImplementation,
  };
}

module.exports = { createHarnessContext };
