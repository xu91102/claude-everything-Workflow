"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");

test("每个正式 skill 都有唯一来源与同步策略", () => {
  const skillsDir = path.join(root, "skills");
  const actual = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
  const sources = JSON.parse(
    fs.readFileSync(path.join(skillsDir, "sources.json"), "utf8"),
  );
  const declared = Object.keys(sources.skills).sort();

  assert.deepEqual(declared, actual);
  for (const [name, metadata] of Object.entries(sources.skills)) {
    assert.match(metadata.origin, /^(upstream|cew)$/, name);
    assert.match(metadata.strategy, /^(overlay|own|follow|retire)$/, name);
    if (metadata.origin === "cew") assert.equal(metadata.strategy, "own", name);
  }
});

test("console 检查只在 strict Hook Profile 启用", () => {
  const settings = JSON.parse(
    fs.readFileSync(path.join(root, "settings.json"), "utf8"),
  );
  const commands = settings.hooks.PostToolUse.flatMap((entry) =>
    entry.hooks.map((hook) => hook.command),
  );
  const consoleHook = commands.find((command) =>
    command.includes("post:edit:console-log"),
  );

  assert.ok(consoleHook);
  assert.match(consoleHook, / strict$/);
  assert.doesNotMatch(consoleHook, /standard/);
});
