"use strict";

const fs = require("fs");
const path = require("path");
const commonmark = require("commonmark");

const MANAGED_ROOTS = [
  "README.md",
  "README.zh-CN.md",
  "AGENTS.md",
  "CLAUDE.md",
  "settings.json",
  "commands",
  "agents",
  "skills",
  "hooks",
  "scripts",
  "rules",
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
    const localText = body.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s)]+/gi, "");
    let links;
    let resourceLiterals;
    for (const token of tokens) {
      if (/^(?:skills|rules|references|agents|commands|scripts|harness)\//.test(token)) {
        if (!links) {
          links = new Set();
          const literals = [];
          const walker = new commonmark.Parser().parse(body).walker();
          let linkDepth = 0;
          let event;
          while ((event = walker.next())) {
            if (event.node.type !== "link") {
              if (event.entering && linkDepth === 0 && event.node.literal) literals.push(event.node.literal);
              continue;
            }
            linkDepth += event.entering ? 1 : -1;
            if (!event.entering) continue;
            const destination = event.node.destination.split(/[?#]/)[0];
            if (!destination || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(destination)) continue;
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), destination));
            if (!target.startsWith("../") && exists(target)) links.add(target);
          }
          resourceLiterals = literals.join("\n").replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s)]+/gi, "");
        }
        if (links.has(token) || resourceLiterals.includes(token)) continue;
      } else if (localText.includes(token)) continue;
      fail(`${file} should include ${token}`);
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

module.exports = { createHarnessContext, createTokenChecker };
