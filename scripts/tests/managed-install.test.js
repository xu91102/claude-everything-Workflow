"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  MANIFEST_NAME,
  installWorkflow,
  readManifest,
} = require("../lib/managed-install");

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function createFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "cew-install-"));
  const root = path.join(base, "package");
  const home = path.join(base, "home");
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  write(root, "package.json", '{"name":"fixture","version":"1.2.3"}\n');
  write(root, "AGENTS.md", "agents\n");
  write(root, "CLAUDE.md", "claude\n");
  write(root, "settings.json", '{"hooks":{}}\n');
  write(root, "rules/base.md", "base\n");
  write(root, "hooks/runtime.js", "runtime\n");
  write(root, "skills/using-superpowers/SKILL.md", "core\n");
  write(root, "skills/context-budget/SKILL.md", "coding\n");
  write(root, "homunculus/README.md", "full-only\n");
  write(root, "references/review.md", "full-only\n");
  return { base, home, root };
}

test("更新会清理未修改的废弃受管文件", () => {
  const fixture = createFixture();
  const output = [];
  installWorkflow({
    rootDir: fixture.root,
    homeDir: fixture.home,
    targets: ["codex"],
    profile: "full",
    output: (line) => output.push(line),
  });
  const obsolete = path.join(fixture.home, ".codex", "rules", "base.md");
  assert.equal(fs.existsSync(obsolete), true);

  fs.unlinkSync(path.join(fixture.root, "rules", "base.md"));
  installWorkflow({
    rootDir: fixture.root,
    homeDir: fixture.home,
    targets: ["codex"],
    profile: "full",
    output: (line) => output.push(line),
  });

  assert.equal(fs.existsSync(obsolete), false);
});

test("更新会把用户修改过的废弃受管文件移入安全备份区", () => {
  const fixture = createFixture();
  const output = [];
  installWorkflow({
    rootDir: fixture.root,
    homeDir: fixture.home,
    targets: ["codex"],
    profile: "full",
    output: (line) => output.push(line),
  });
  const obsolete = path.join(fixture.home, ".codex", "rules", "base.md");
  fs.writeFileSync(obsolete, "user changed\n");
  fs.unlinkSync(path.join(fixture.root, "rules", "base.md"));

  installWorkflow({
    rootDir: fixture.root,
    homeDir: fixture.home,
    targets: ["codex"],
    profile: "full",
    output: (line) => output.push(line),
  });

  assert.equal(fs.existsSync(obsolete), false);
  const backupRoot = path.join(fixture.home, ".codex", ".cew-backups");
  const backupContent = fs
    .readdirSync(backupRoot)
    .map((stamp) => path.join(backupRoot, stamp, "rules", "base.md"))
    .find((candidate) => fs.existsSync(candidate));
  assert.ok(backupContent);
  assert.equal(fs.readFileSync(backupContent, "utf8"), "user changed\n");
  assert.equal(
    output.some((line) => line.includes("迁移已修改的废弃受管文件")),
    true,
  );
});

test("切换 coding profile 会安全移除 full 专属文件", () => {
  const fixture = createFixture();
  installWorkflow({
    rootDir: fixture.root,
    homeDir: fixture.home,
    targets: ["codex"],
    profile: "full",
    output: () => {},
  });
  installWorkflow({
    rootDir: fixture.root,
    homeDir: fixture.home,
    targets: ["codex"],
    profile: "coding",
    output: () => {},
  });

  const codex = path.join(fixture.home, ".codex");
  assert.equal(fs.existsSync(path.join(codex, "homunculus", "README.md")), false);
  assert.equal(fs.existsSync(path.join(codex, "references", "review.md")), false);
  assert.equal(fs.existsSync(path.join(codex, "skills", "context-budget", "SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(codex, MANIFEST_NAME)), true);
  assert.equal(readManifest(codex).profile, "coding");
});

test("首次受管安装会迁移已知旧版 skill 目录", () => {
  const fixture = createFixture();
  const legacySkill = path.join(
    fixture.home,
    ".codex",
    "skills",
    "skill-creator",
    "SKILL.md",
  );
  fs.mkdirSync(path.dirname(legacySkill), { recursive: true });
  fs.writeFileSync(legacySkill, "legacy\n");

  installWorkflow({
    rootDir: fixture.root,
    homeDir: fixture.home,
    targets: ["codex"],
    profile: "full",
    output: () => {},
  });

  assert.equal(fs.existsSync(path.dirname(legacySkill)), false);
  const backupRoot = path.join(fixture.home, ".codex", ".cew-backups");
  const backupSkill = fs
    .readdirSync(backupRoot)
    .map((stamp) =>
      path.join(backupRoot, stamp, "skills", "skill-creator", "SKILL.md"),
    )
    .find((candidate) => fs.existsSync(candidate));
  assert.ok(backupSkill);
});

test("拒绝 manifest 路径越界且不删除目标外文件", () => {
  const fixture = createFixture();
  const codex = path.join(fixture.home, ".codex");
  const outside = path.join(fixture.home, "outside.txt");
  fs.mkdirSync(codex, { recursive: true });
  fs.writeFileSync(outside, "keep\n");
  fs.writeFileSync(
    path.join(codex, MANIFEST_NAME),
    `${JSON.stringify({
      schemaVersion: 1,
      files: [{ path: "../outside.txt", hash: "invalid" }],
      hookKeys: [],
    })}\n`,
  );

  assert.throws(
    () =>
      installWorkflow({
        rootDir: fixture.root,
        homeDir: fixture.home,
        targets: ["codex"],
        profile: "full",
        output: () => {},
      }),
    /manifest 路径越界/,
  );
  assert.equal(fs.readFileSync(outside, "utf8"), "keep\n");
});

test("Claude settings 损坏时在写入任何受管文件前失败", () => {
  const fixture = createFixture();
  const claude = path.join(fixture.home, ".claude");
  fs.mkdirSync(claude, { recursive: true });
  fs.writeFileSync(path.join(claude, "settings.json"), "{invalid\n");

  assert.throws(
    () =>
      installWorkflow({
        rootDir: fixture.root,
        homeDir: fixture.home,
        targets: ["claude"],
        profile: "full",
        output: () => {},
      }),
    /无法解析 JSON 文件/,
  );
  assert.equal(fs.existsSync(path.join(claude, "AGENTS.md")), false);
  assert.equal(fs.existsSync(path.join(claude, MANIFEST_NAME)), false);
});
