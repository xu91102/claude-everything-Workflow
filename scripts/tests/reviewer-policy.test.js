"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const reviewers = [
  "agents/code-reviewer.md",
  "agents/database-reviewer.md",
  "agents/security-reviewer.md",
  "agents/refactor-cleaner.md",
];

test("默认 reviewer 不暴露写入或命令执行工具", () => {
  for (const relativePath of reviewers) {
    const body = fs.readFileSync(path.join(root, relativePath), "utf8");
    const toolsLine = body.split(/\r?\n/).find((line) => line.startsWith("tools:"));
    assert.ok(toolsLine, `${relativePath} 缺少 tools`);
    assert.doesNotMatch(toolsLine, /"Write"|"Edit"|"Bash"/, relativePath);
  }
});
