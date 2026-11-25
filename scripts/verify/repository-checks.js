"use strict";

const path = require("path");

const PATH_REF_PATTERN = /`((?:skills|rules|agents|commands)\/[A-Za-z0-9_./-]+\.(?:md|json|yaml|yml|js|cjs|sh|ps1))`/g;
const LOCAL_REF_PATTERN = /`(references\/[A-Za-z0-9_./-]+\.(?:md|json|yaml|yml|js|cjs|sh|ps1))`/g;
const MD_LINK_PATTERN = /\]\(([^)#\s]+\.(?:md|json|yaml|yml|js|cjs|sh|ps1))\)/g;

function checkPathReferences({ managedFiles, isVerifierImplementation, exists, read, fail }) {
  const rootsToCheck = ["AGENTS.md", "CLAUDE.md"];
  for (const file of managedFiles()) {
    if (isVerifierImplementation(file)) continue;
    if (
      !rootsToCheck.includes(file) &&
      !/^(?:rules|skills|agents|commands)\//.test(file)
    ) {
      continue;
    }
    if (!file.endsWith(".md")) continue;

    const body = read(file);
    const dir = path.posix.dirname(file);

    for (const [, target] of body.matchAll(PATH_REF_PATTERN)) {
      if (target.includes("<") || target.includes("*")) continue;
      if (!exists(target)) {
        fail(`${file} references missing path: ${target}`);
      }
    }

    if (/^skills\/[^/]+\/SKILL\.md$/.test(file)) {
      for (const [, target] of body.matchAll(LOCAL_REF_PATTERN)) {
        if (target.includes("<") || target.includes("*")) continue;
        const skillLocal = path.posix.join(dir, target);
        if (!exists(skillLocal) && !exists(target)) {
          fail(`${file} references missing path: ${target}`);
        }
      }
    }

    for (const [, link] of body.matchAll(MD_LINK_PATTERN)) {
      if (/^(?:https?:|mailto:|\/)/.test(link) || link.includes("<") || link.includes("*")) continue;
      const resolved = path.posix.normalize(dir === "." ? link : path.posix.join(dir, link));
      if (!exists(resolved)) {
        fail(`${file} links to missing path: ${link} (resolved: ${resolved})`);
      }
    }
  }
}

function checkRuleLoadingPolicy({ requireTokens }) {
  requireTokens("AGENTS.md", [
    "rules/common/",
    "01-base.md",
    "02-implementation.md",
    "05-git-workflow.md",
    "using-superpowers",
  ]);
  requireTokens("CLAUDE.md", [
    "@AGENTS.md",
    "~/.claude/references/rules/",
  ]);
}

function runRepositoryChecks(context) {
  checkPathReferences(context);
  checkRuleLoadingPolicy(context);
}

module.exports = { runRepositoryChecks };
