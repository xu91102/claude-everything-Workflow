#!/usr/bin/env node
"use strict";

/**
 * Antigravity PreToolUse Hook 适配器
 *
 * 读取 Antigravity camelCase stdin JSON，将含 git commit 的 run_command 调用
 * 转发给 hooks/commit-quality.js，并输出符合 hooks.json 契约的 JSON 决策。
 */

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { isHookEnabled } = require("./hook-flags");

const HOOK_ID = "pre:bash:commit-quality";
const PROFILES = "standard,strict";

function isValidDirString(value) {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("\0");
}

function resolveWorkDir(payload) {
  const workspacePaths = Array.isArray(payload?.workspacePaths) ? payload.workspacePaths : [];
  const workspaceRoot = workspacePaths.find(isValidDirString);
  const baseCwd = isValidDirString(payload?.cwd)
    ? payload.cwd
    : workspaceRoot || process.cwd();

  const rawToolCwd = payload?.toolCall?.args?.Cwd;
  if (rawToolCwd !== undefined && rawToolCwd !== null) {
    if (typeof rawToolCwd !== "string" || rawToolCwd.includes("\0")) {
      return { valid: false };
    }
    if (rawToolCwd.trim()) {
      const resolved = path.isAbsolute(rawToolCwd)
        ? rawToolCwd
        : path.resolve(baseCwd, rawToolCwd);
      return { valid: true, cwd: resolved };
    }
  }

  return { valid: true, cwd: baseCwd };
}

function run(raw) {
  if (!isHookEnabled(HOOK_ID, { profiles: PROFILES })) {
    return { decision: "allow" };
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { decision: "allow" };
  }

  const toolName = payload?.toolCall?.name;
  const commandLine = payload?.toolCall?.args?.CommandLine;
  if (toolName !== "run_command" || typeof commandLine !== "string" || !commandLine.trim()) {
    return { decision: "allow" };
  }

  if (!/\bcommit\b/i.test(commandLine)) {
    return { decision: "allow" };
  }

  const workDir = resolveWorkDir(payload);
  if (!workDir.valid) {
    return { decision: "deny", reason: "Invalid run_command working directory." };
  }

  const commitQualityPath = path.resolve(__dirname, "..", "commit-quality.js");
  const result = spawnSync(process.execPath, [commitQualityPath], {
    input: JSON.stringify({ tool_input: { command: commandLine } }),
    cwd: workDir.cwd,
    encoding: "utf8",
    timeout: 8000,
  });

  if (result.error || (result.status !== 0 && result.status !== 2)) {
    return {
      decision: "deny",
      reason: "Could not run the commit check in the requested working directory.",
    };
  }
  const reason = (result.stderr || "").trim();
  if (result.status === 2) {
    return {
      decision: "deny",
      reason: reason || "Commit blocked by cew-commit-quality hook.",
    };
  }

  return reason ? { decision: "allow", reason } : { decision: "allow" };
}

module.exports = { run };

if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    raw += chunk;
  });
  process.stdin.on("end", () => {
    try {
      process.stdout.write(`${JSON.stringify(run(raw))}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(
        `${JSON.stringify({ decision: "allow", reason: `cew-commit-quality hook error: ${message}` })}\n`,
      );
    }
    process.exit(0);
  });
}
