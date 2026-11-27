#!/usr/bin/env node
"use strict";

/**
 * Antigravity PreToolUse Hook 适配器
 *
 * 读取 Antigravity camelCase stdin JSON，将 run_command 调用转发给
 * hooks/commit-quality.js，并输出符合 hooks.json 契约的 JSON 决策。
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { isHookEnabled } = require("./hook-flags");

const HOOK_ID = "pre:bash:commit-quality";
const PROFILES = "standard,strict";

function resolveCwd(candidate) {
  if (typeof candidate === "string" && candidate.trim()) {
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Fallback to process.cwd() when payload cwd is unavailable.
    }
  }
  return process.cwd();
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

  const commitQualityPath = path.resolve(__dirname, "..", "commit-quality.js");
  if (!fs.existsSync(commitQualityPath)) {
    return { decision: "allow" };
  }

  const result = spawnSync(process.execPath, [commitQualityPath], {
    input: JSON.stringify({ tool_input: { command: commandLine } }),
    cwd: resolveCwd(payload?.cwd),
    encoding: "utf8",
    timeout: 10000,
  });

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
    process.stdout.write(`${JSON.stringify(run(raw))}\n`);
    process.exit(0);
  });
}
