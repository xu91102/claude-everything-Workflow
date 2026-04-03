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

function getObservationsPath() {
  return path.join(os.homedir(), ".claude", "homunculus", "observations.jsonl");
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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

        const observation = {
          timestamp: new Date().toISOString(),
          phase: phase,
          tool: input.tool,
          session_id: input.session_id,
          tool_input: input.tool_input,
        };

        // 追加到观察记录
        fs.appendFileSync(observationsPath, JSON.stringify(observation) + "\n");
      }

      // 透传原始数据
      console.log(data);
    } catch (error) {
      console.log(data);
    }
  });
}

main();
