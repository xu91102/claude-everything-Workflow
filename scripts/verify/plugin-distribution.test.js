"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

test("both marketplaces resolve to the same self-contained, versioned workflow package", () => {
  const pkg = readJson("package.json");
  const claude = readJson(".claude-plugin/plugin.json");
  const codex = readJson(".codex-plugin/plugin.json");
  for (const manifest of [claude, codex]) {
    assert.equal(manifest.name, pkg.name);
    assert.equal(manifest.version, pkg.version, "bump package and both plugin versions together");
  }
  const markets = [readJson(".claude-plugin/marketplace.json"), readJson(".agents/plugins/marketplace.json")];
  for (const market of markets) {
    assert.equal(market.name, "cew");
    assert.equal(market.plugins.length, 1);
    assert.equal(market.plugins[0].name, pkg.name);
    const source = market.plugins[0].source;
    assert.equal(path.resolve(root, typeof source === "string" ? source : source.path), root);
  }
  assert.ok(fs.existsSync(path.join(root, codex.skills, "using-superpowers/SKILL.md")));
  assert.ok(!("hooks" in codex), "Claude hook events must not be advertised as Codex hooks");
  const hooks = readJson(claude.hooks).hooks;
  for (const groups of Object.values(hooks)) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        assert.ok(hook.command.includes("${CLAUDE_PLUGIN_ROOT}"));
        assert.ok(!hook.command.includes("$HOME"));
        const entry = hook.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\"]+)"/)[1];
        assert.ok(fs.existsSync(path.join(root, entry)), entry);
      }
    }
  }
});
