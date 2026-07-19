#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");

function parsePayload(argv) {
  if (argv.length !== 2 || argv[0] !== "--payload") return null;
  try {
    const value = JSON.parse(Buffer.from(argv[1], "base64url").toString("utf8"));
    if (
      value === null ||
      typeof value !== "object" ||
      !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(value.checkId) ||
      !Array.isArray(value.command) ||
      value.command.length === 0 ||
      !value.command.every((item) => typeof item === "string" && item.length > 0) ||
      !Number.isInteger(value.exitCode)
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function main(argv = process.argv.slice(2)) {
  const payload = parsePayload(argv);
  if (!payload) return 2;
  const [rawCommand, ...args] = payload.command;
  const command = rawCommand === "node" ? process.execPath : rawCommand;
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    shell: false,
    stdio: "inherit",
    timeout: 30000,
  });
  if (result.error || typeof result.status !== "number") return 2;
  return result.status === payload.exitCode ? 0 : 1;
}

if (require.main === module) process.exitCode = main();

module.exports = { main, parsePayload };
