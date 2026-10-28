#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function syncVerificationReference({ root = path.resolve(__dirname, ".."), check = false } = {}) {
  const sources = [["rules/common/testing.md", "verification.md"],
    ["rules/common/pr-automation.md", "pr-automation.md"], ["rules/05-git-workflow.md", "git-workflow.md"]];
  const targets = new Map(sources.map(([source, name]) => [source, `references/${name}`]));
  const href = logical => path.posix.relative("references", targets.get(logical) || logical);
  const render = body => body
    .replace(/`((?:rules|skills|references)\/[^`\n<>]+\.md)`/g,
      (_, logical) => `[${logical}](${href(logical)})`)
    .replace(/\]\((rules\/[^)\s]+\.md)\)/g, (_, logical) => `](${href(logical)})`);
  const contracts = sources
    .map(([source, name]) => ({
      target: path.join(root, "references", name),
      content: `<!-- Generated from ${source}; update with node scripts/sync-verification-reference.js. -->\n\n`
        + render(fs.readFileSync(path.join(root, source), "utf8")),
    }));
  const stale = contracts.filter(({ target, content }) =>
    !fs.existsSync(target) || fs.readFileSync(target, "utf8") !== content);
  if (check) return stale.length === 0;
  for (const { target, content } of stale) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return true;
}

module.exports = { syncVerificationReference };

if (require.main === module) {
  if (process.argv.slice(2).some(arg => arg !== "--check")) throw Error("Expected only --check");
  const current = syncVerificationReference({ check: process.argv.includes("--check") });
  if (!current) process.stderr.write("Workflow references are stale; run node scripts/sync-verification-reference.js\n");
  process.exitCode = current ? 0 : 1;
}
