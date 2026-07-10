"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  hookKey,
  mergeClaudeSettings,
} = require("../lib/settings-merge");

function hook(command) {
  return { type: "command", command, timeout: 5 };
}

function entry(matcher, hooks) {
  return { matcher, hooks };
}

test("保留同事件下的用户 Hook，并追加 CEW Hook", () => {
  const userHook = hook("node /opt/user/post-edit.js");
  const cewHook = hook(
    'node "$HOME/.claude/hooks/runtime/run-with-flags.js" post:edit:code-size ' +
      '"$HOME/.claude/hooks/check-code-size.js" standard,strict',
  );
  const existing = {
    env: { USER_VALUE: "kept" },
    hooks: { PostToolUse: [entry("Edit|Write", [userHook])] },
  };
  const source = {
    env: { CEW_VALUE: "default" },
    hooks: { PostToolUse: [entry("Edit|Write", [cewHook])] },
  };

  const result = mergeClaudeSettings({ existing, source });
  const commands = result.settings.hooks.PostToolUse.flatMap((item) =>
    item.hooks.map((itemHook) => itemHook.command),
  );

  assert.deepEqual(result.settings.env, {
    CEW_VALUE: "default",
    USER_VALUE: "kept",
  });
  assert.deepEqual(commands, [userHook.command, cewHook.command]);
  assert.deepEqual(result.hookKeys, [hookKey(cewHook)]);
});

test("升级时只替换上次受管 Hook，不删除用户 Hook", () => {
  const userHook = hook("node /opt/user/post-edit.js");
  const oldHook = hook(
    'node "$HOME/.claude/hooks/runtime/run-with-flags.js" post:edit:code-size old.js standard',
  );
  const newHook = hook(
    'node "$HOME/.claude/hooks/runtime/run-with-flags.js" post:edit:code-size new.js standard,strict',
  );
  const existing = {
    hooks: { PostToolUse: [entry("Edit", [userHook, oldHook])] },
  };
  const source = {
    hooks: { PostToolUse: [entry("Edit", [newHook])] },
  };

  const result = mergeClaudeSettings({
    existing,
    source,
    previousHookKeys: [hookKey(oldHook)],
  });
  const commands = result.settings.hooks.PostToolUse.flatMap((item) =>
    item.hooks.map((itemHook) => itemHook.command),
  );

  assert.deepEqual(commands, [userHook.command, newHook.command]);
});

test("清理旧版 Hook 路径但保留同 matcher 的用户 Hook", () => {
  const userHook = hook("node /opt/user/pre-bash.js");
  const legacyHook = hook('node "$HOME/.claude/hooks/session-start.js"');
  const sourceHook = hook(
    'node "$HOME/.claude/hooks/runtime/run-with-flags.js" pre:bash:quality current.js standard',
  );
  const existing = {
    hooks: { PreToolUse: [entry("Bash", [userHook, legacyHook])] },
  };
  const source = {
    hooks: { PreToolUse: [entry("Bash", [sourceHook])] },
  };

  const result = mergeClaudeSettings({ existing, source });
  const commands = result.settings.hooks.PreToolUse.flatMap((item) =>
    item.hooks.map((itemHook) => itemHook.command),
  );

  assert.deepEqual(commands, [userHook.command, sourceHook.command]);
});

test("首次安装不会因通用遗留路径片段删除用户 Hook", () => {
  const userHook = hook("node /opt/acme/scripts/lib/utils.js --audit");
  const sourceHook = hook(
    'node "$HOME/.claude/hooks/runtime/run-with-flags.js" post:edit:code-size current.js standard,strict',
  );
  const result = mergeClaudeSettings({
    existing: {
      hooks: { PostToolUse: [entry("Edit", [userHook])] },
    },
    source: {
      hooks: { PostToolUse: [entry("Edit", [sourceHook])] },
    },
  });
  const commands = result.settings.hooks.PostToolUse.flatMap((item) =>
    item.hooks.map((itemHook) => itemHook.command),
  );

  assert.deepEqual(commands, [userHook.command, sourceHook.command]);
});
