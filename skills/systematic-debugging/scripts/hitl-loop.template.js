#!/usr/bin/env node
"use strict";

// Human-in-the-loop reproduction loop.
// 复制此文件、修改下方步骤，再通过 Node.js 运行。

const readline = require("node:readline");
const process = require("node:process");

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY),
});
const lines = terminal[Symbol.asyncIterator]();

let interrupted = false;

terminal.on("SIGINT", () => {
  interrupted = true;
  process.stderr.write("\n[HITL] 已取消。\n");
  terminal.close();
});

async function ask(prompt) {
  process.stdout.write(prompt);
  const { value, done } = await lines.next();
  if (done) {
    throw new Error(interrupted ? "交互已取消" : "输入已结束");
  }
  return value;
}

async function step(instruction) {
  process.stdout.write(`\n>>> ${instruction}\n`);
  await ask("    [完成后按 Enter] ");
}

async function capture(variable, question) {
  process.stdout.write(`\n>>> ${question}\n`);
  return [variable, await ask("    > ")];
}

async function main() {
  // --- 在下方编辑 -------------------------------------------------------

  await step("打开 http://localhost:3000，登录应用。");

  const [erroredKey, errored] = await capture(
    "ERRORED",
    "点击“导出”按钮后是否出现错误？（是/否）",
  );

  const [messageKey, errorMessage] = await capture(
    "ERROR_MSG",
    "粘贴错误信息；若没有，请输入“无”：",
  );

  // --- 在上方编辑 -------------------------------------------------------

  process.stdout.write("\n--- 已捕获 ---\n");
  process.stdout.write(`${erroredKey}=${errored}\n`);
  process.stdout.write(`${messageKey}=${errorMessage}\n`);
}

main()
  .catch((error) => {
    if (!interrupted) {
      process.stderr.write(`[HITL] 失败：${error.message}\n`);
      process.exitCode = 1;
    } else {
      process.exitCode = 130;
    }
  })
  .finally(() => terminal.close());
