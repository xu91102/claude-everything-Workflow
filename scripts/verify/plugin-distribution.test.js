"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const os = require("node:os");
const commonmark = require("commonmark");
const { syncVerificationReference } = require("../sync-verification-reference");

const root = path.resolve(__dirname, "../..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const sourceText = body => body.replace(/^<!--[\s\S]*?-->\r?\n\r?\n/, "")
  .replace(/\[((?:rules|skills|references)\/[^\]]+\.md)\]\([^)]+\)/g, "`$1`");

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

test("plugin-only workflow entries resolve one shared verification contract without user rules", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "cew-plugin-only-"));
  const bundle = path.join(fixture, "plugin");
  const entries = ["skills/using-superpowers/SKILL.md", "skills/implement/SKILL.md",
    "skills/feature-acceptance/SKILL.md", "commands/verify.md", "commands/pr.md"];
  try {
    fs.mkdirSync(path.join(fixture, "empty-home"));
    fs.mkdirSync(path.join(fixture, "project"));
    const contract = path.join(root, "references/verification.md");
    for (const entry of entries) {
      const body = fs.readFileSync(path.join(root, entry), "utf8");
      const walker = new commonmark.Parser().parse(body).walker();
      const links = [];
      let event;
      while ((event = walker.next())) {
        if (event.entering && event.node.type === "link" &&
          event.node.destination.endsWith("/references/verification.md")) links.push(event.node.destination);
      }
      assert.ok(links.length, `${entry} needs a package-relative verification fallback`);
      const target = path.join(bundle, entry);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, entry), target);
      assert.ok(fs.existsSync(contract), "shared verification contract must be shipped");
      fs.mkdirSync(path.join(bundle, "references"), { recursive: true });
      fs.copyFileSync(contract, path.join(bundle, "references/verification.md"));
      for (const link of links) {
        const resolved = path.resolve(path.dirname(target), link);
        assert.ok(resolved.startsWith(bundle + path.sep), "fallback must not use an ambient user directory");
        assert.equal(fs.readFileSync(resolved, "utf8"), fs.readFileSync(contract, "utf8"));
      }
    }
    const shared = sourceText(fs.readFileSync(contract, "utf8"));
    assert.equal(shared, fs.readFileSync(path.join(root, "rules/common/testing.md"), "utf8"),
      "the distributed fallback must follow the single authoritative testing contract");
    for (const entry of ["commands/pr.md", "commands/verify.md"]) {
      const body = fs.readFileSync(path.join(root, entry), "utf8");
      const walker = new commonmark.Parser().parse(body).walker();
      const links = [];
      let event;
      while ((event = walker.next())) {
        if (event.entering && event.node.type === "link" &&
          event.node.destination.endsWith("/references/pr-automation.md")) links.push(event.node.destination);
      }
      assert.ok(links.length, `${entry} needs a package-relative PR authorization contract`);
      const prContract = path.join(root, "references/pr-automation.md");
      fs.copyFileSync(prContract, path.join(bundle, "references/pr-automation.md"));
      for (const link of links) {
        const resolved = path.resolve(path.dirname(path.join(bundle, entry)), link);
        assert.ok(resolved.startsWith(bundle + path.sep));
        const distributed = sourceText(fs.readFileSync(resolved, "utf8"));
        assert.equal(distributed, fs.readFileSync(path.join(root, "rules/common/pr-automation.md"), "utf8"));
      }
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("plugin authorization and verification references close without ambient rules", () => {
  const entries = ["commands/pr.md", "commands/verify.md", "skills/implement/SKILL.md",
    "skills/using-superpowers/SKILL.md", "skills/feature-acceptance/SKILL.md"];
  const contracts = ["references/git-workflow.md", "references/pr-automation.md", "references/verification.md"];
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "cew-plugin-contracts-"));
  try {
    const bundle = path.join(fixture, "plugin");
    // Packaged cold references exist; user/project rules and AGENTS are absent.
    for (const dir of ["commands", "skills", "references", "rules", "agents"])
      fs.cpSync(path.join(root, dir), path.join(bundle, dir), { recursive: true });
    assert.ok(!fs.existsSync(path.join(fixture, "rules")));
    assert.ok(!fs.existsSync(path.join(bundle, "AGENTS.md")));
    for (const file of [...entries, ...contracts]) {
      const body = fs.readFileSync(path.join(bundle, file), "utf8");
      const walker = new commonmark.Parser().parse(body).walker();
      const targets = [];
      let event;
      while ((event = walker.next())) {
        if (!event.entering) continue;
        if (event.node.type === "code")
          assert.ok(!/^rules\//.test(event.node.literal), `${file} relies on an ambient logical rule`);
        if (event.node.type === "link" && !/^[a-z]+:|^#/.test(event.node.destination)) {
          const target = path.resolve(path.dirname(path.join(bundle, file)), event.node.destination);
          assert.ok(target.startsWith(bundle + path.sep), `${file} escapes the plugin`);
          assert.ok(fs.existsSync(target), `${file}: missing ${event.node.destination}`);
          targets.push(target);
        }
      }
      if (["commands/pr.md", "skills/implement/SKILL.md", "skills/using-superpowers/SKILL.md"].includes(file))
        assert.ok(targets.includes(path.join(bundle, "references/git-workflow.md")), `${file} lacks Git authority`);
    }
    const git = fs.readFileSync(path.join(bundle, "references/git-workflow.md"), "utf8");
    for (const boundary of ["不丢弃或覆盖用户已有改动", "未获明确授权", "创建 PR 的授权不覆盖合并 PR 或发布"])
      assert.ok(git.includes(boundary), `missing authorization/isolation boundary: ${boundary}`);
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});

test("generated contracts rewrite logical and Markdown rule references", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "cew-reference-rewrite-"));
  try {
    fs.mkdirSync(path.join(fixture, "rules/common"), { recursive: true });
    fs.writeFileSync(path.join(fixture, "rules/common/testing.md"), "Verify via `rules/05-git-workflow.md`.\n");
    fs.writeFileSync(path.join(fixture, "rules/common/pr-automation.md"), "[checks](rules/common/testing.md)\n");
    fs.writeFileSync(path.join(fixture, "rules/05-git-workflow.md"), "Git uses `rules/common/pr-automation.md`.\n");
    syncVerificationReference({ root: fixture });
    assert.ok(fs.readFileSync(path.join(fixture, "references/verification.md"), "utf8")
      .includes("[rules/05-git-workflow.md](git-workflow.md)"));
    assert.ok(fs.readFileSync(path.join(fixture, "references/pr-automation.md"), "utf8")
      .includes("[checks](verification.md)"));
    assert.ok(fs.readFileSync(path.join(fixture, "references/git-workflow.md"), "utf8")
      .includes("[rules/common/pr-automation.md](pr-automation.md)"));
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});

test("verification fallback detects canonical drift and check mode never overwrites evidence", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "cew-verification-reference-"));
  try {
    fs.mkdirSync(path.join(fixture, "rules/common"), { recursive: true });
    fs.mkdirSync(path.join(fixture, "references"));
    const canonical = path.join(fixture, "rules/common/testing.md");
    const prCanonical = path.join(fixture, "rules/common/pr-automation.md");
    const distributed = path.join(fixture, "references/verification.md");
    fs.writeFileSync(canonical, "Only verified outcomes may pass.\n");
    fs.writeFileSync(prCanonical, "Draft authorization does not authorize merging.\n");
    fs.writeFileSync(path.join(fixture, "rules/05-git-workflow.md"), "Protect user changes and require publication authority.\n");
    fs.writeFileSync(distributed, "outdated evidence\n");
    assert.equal(syncVerificationReference({ root: fixture, check: true }), false);
    assert.equal(fs.readFileSync(distributed, "utf8"), "outdated evidence\n");
    assert.equal(syncVerificationReference({ root: fixture }), true);
    assert.equal(syncVerificationReference({ root: fixture, check: true }), true);
    const recorded = fs.readFileSync(distributed, "utf8");
    fs.writeFileSync(canonical, "Updated contract requires a regression check.\n");
    assert.equal(syncVerificationReference({ root: fixture, check: true }), false);
    assert.equal(fs.readFileSync(distributed, "utf8"), recorded);
    assert.equal(syncVerificationReference({ root: fixture }), true);
    const prDistributed = path.join(fixture, "references/pr-automation.md");
    const recordedPr = fs.readFileSync(prDistributed, "utf8");
    fs.writeFileSync(prCanonical, "Required checks remain failed after draft authorization.\n");
    assert.equal(syncVerificationReference({ root: fixture, check: true }), false);
    assert.equal(fs.readFileSync(prDistributed, "utf8"), recordedPr);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
