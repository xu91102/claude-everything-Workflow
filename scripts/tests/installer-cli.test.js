"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");

function runInstall(home, args) {
  return spawnSync("bash", [path.join(root, "scripts", "install.sh"), ...args], {
    cwd: root,
    env: { ...process.env, HOME: home },
    encoding: "utf8",
    timeout: 30000,
  });
}

function collectCommands(settings) {
  const commands = [];
  for (const entries of Object.values(settings.hooks || {})) {
    for (const entry of entries) {
      for (const hook of entry.hooks || []) {
        if (typeof hook.command === "string") commands.push(hook.command);
      }
    }
  }
  return commands;
}

test("真实安装保留用户同事件 Hook，且重复安装不产生重复项", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cew-cli-"));
  const claude = path.join(home, ".claude");
  fs.mkdirSync(claude, { recursive: true });
  const userCommand = "node /opt/user/post-edit.js";
  fs.writeFileSync(
    path.join(claude, "settings.json"),
    `${JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: "Edit|Write|MultiEdit",
            hooks: [{ type: "command", command: userCommand }],
          },
        ],
      },
    })}\n`,
  );

  const first = runInstall(home, ["--claude-only", "--profile", "core"]);
  assert.equal(first.status, 0, first.stderr);
  const second = runInstall(home, ["--claude-only", "--profile", "core"]);
  assert.equal(second.status, 0, second.stderr);

  const settings = JSON.parse(
    fs.readFileSync(path.join(claude, "settings.json"), "utf8"),
  );
  const commands = collectCommands(settings);
  assert.equal(commands.filter((command) => command === userCommand).length, 1);
  assert.equal(commands.filter((command) => command.includes("post:edit:code-size")).length, 1);
  assert.equal(commands.some((command) => command.includes("post:observe")), false);
  assert.equal(fs.existsSync(path.join(claude, ".cew-manifest.json")), true);
});

test("dry-run 不创建目标目录或 manifest", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cew-dry-run-"));
  const result = runInstall(home, ["--codex-only", "--dry-run"]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(home, ".codex")), false);
  assert.match(result.stdout, /\[dry-run\]/);
});
