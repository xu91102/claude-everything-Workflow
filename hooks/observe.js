#!/usr/bin/env node
/**
 * Observe Hook
 *
 * 观察工具调用，记录会话活动
 * 用于 PreToolUse/PostToolUse hook
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const MAX_TOOL_INPUT_CHARS = 2000;

function getObservationsPath() {
  return path.join(os.homedir(), ".claude", "homunculus", "observations.jsonl");
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function compactPayload(value, maxChars) {
  if (value === undefined || value === null) {
    return value;
  }

  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length <= maxChars) {
    return value;
  }

  return {
    truncated: true,
    original_chars: serialized.length,
    preview: serialized.slice(0, maxChars),
  };
}

function getProjectContext(input) {
  const cwd = input.cwd || input.tool_input?.cwd || process.cwd();
  let projectRoot = cwd;

  try {
    projectRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      timeout: 1000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    projectRoot = path.resolve(cwd);
  }

  const projectId = crypto
    .createHash("sha1")
    .update(projectRoot.toLowerCase())
    .digest("hex")
    .slice(0, 12);

  return {
    cwd,
    project_root: projectRoot,
    project_name: path.basename(projectRoot),
    project_id: projectId,
  };
}

async function main() {
  const phase = process.argv[2]; // 'pre' or 'post'
  const SAMPLE_RATE = 0.1; // 10% 采样率
  const CRITICAL_TOOLS = ["Edit", "Write", "Bash", "NotebookEdit"];

  let data = "";
  process.stdin.on("data", (chunk) => {
    data += chunk;
  });

  process.stdin.on("end", () => {
    try {
      const input = JSON.parse(data);

      // 采样逻辑：关键工具始终记录，其他工具 10% 采样
      const shouldRecord =
        CRITICAL_TOOLS.includes(input.tool) || Math.random() < SAMPLE_RATE;

      if (shouldRecord) {
        const observationsPath = getObservationsPath();
        ensureDir(observationsPath);
        const project = getProjectContext(input);

        const observation = {
          timestamp: new Date().toISOString(),
          phase: phase,
          tool: input.tool,
          session_id: input.session_id,
          ...project,
          tool_input: compactPayload(input.tool_input, MAX_TOOL_INPUT_CHARS),
        };

        // 追加到观察记录
        fs.appendFileSync(observationsPath, JSON.stringify(observation) + "\n");
      }

    } catch (error) {
      console.error(`[Hook] observe failed: ${error.message}`);
    }
  });
}

main();
