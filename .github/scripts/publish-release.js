#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { spawnSync } = require("child_process");

const REGISTRY = "https://registry.npmjs.org";

function run(command, args, { allowFailure = false, timeoutMs = 30000 } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: timeoutMs,
  });

  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    const detail = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(detail || `${command} exited with status ${result.status}`);
  }
  return result;
}

function runNpm(args, options) {
  const injectedCli = process.env.CEW_NPM_CLI;
  if (injectedCli) return run(process.execPath, [injectedCli, ...args], options);
  return run("npm", args, options);
}

function parseStableVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) throw new Error(`Expected stable semver, got ${value}`);
  return match.slice(1).map(Number);
}

function isGreaterVersion(version, latest) {
  const currentParts = parseStableVersion(version);
  const latestParts = parseStableVersion(latest);

  for (let index = 0; index < currentParts.length; index += 1) {
    if (currentParts[index] > latestParts[index]) return true;
    if (currentParts[index] < latestParts[index]) return false;
  }
  return false;
}

function tagCommit(tag) {
  const lookup = run(
    "git",
    ["rev-parse", "-q", "--verify", `refs/tags/${tag}`],
    { allowFailure: true },
  );
  if (lookup.status !== 0) return "";
  return run("git", ["rev-list", "-n", "1", tag]).stdout.trim();
}

function exactVersionIsPublished(packageName, version) {
  const lookup = runNpm(
    ["view", `${packageName}@${version}`, "version", `--registry=${REGISTRY}`],
    { allowFailure: true },
  );
  if (lookup.status === 0) return true;

  const detail = `${lookup.stdout ?? ""}${lookup.stderr ?? ""}`;
  if (!detail.includes("E404")) {
    throw new Error(detail.trim() || "Unable to query the exact npm version");
  }
  return false;
}

function publishPackage() {
  const result = runNpm(["publish"], {
    allowFailure: true,
    timeoutMs: 300000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`npm publish exited with status ${result.status}`);
  }
}

function createAndPushTag(tag, githubSha) {
  run("git", ["tag", "-a", tag, githubSha, "-m", `chore(release): ${tag}`]);
  run("git", ["push", "origin", tag]);
}

function main() {
  const githubSha = process.env.GITHUB_SHA ?? "";
  if (!/^[0-9a-f]{40}$/.test(githubSha)) {
    throw new Error(`Invalid GITHUB_SHA: ${githubSha || "missing"}`);
  }

  const headSha = run("git", ["rev-parse", "HEAD"]).stdout.trim();
  if (headSha !== githubSha) {
    throw new Error(`Checked out ${headSha}, expected ${githubSha}`);
  }

  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const packageName = packageJson.name;
  const version = packageJson.version;
  if (typeof packageName !== "string" || !packageName) {
    throw new Error("package.json name is required");
  }
  parseStableVersion(version);

  const tag = `v${version}`;
  const existingTagCommit = tagCommit(tag);
  if (existingTagCommit && existingTagCommit !== githubSha) {
    throw new Error(`${tag} already points to ${existingTagCommit}, not ${githubSha}`);
  }

  const exactPublished = exactVersionIsPublished(packageName, version);
  if (!exactPublished) {
    const latest = runNpm(
      ["view", packageName, "version", `--registry=${REGISTRY}`],
    ).stdout.trim();
    if (!isGreaterVersion(version, latest)) {
      throw new Error(`${version} must be greater than npm latest ${latest}`);
    }
    publishPackage();
  } else {
    process.stdout.write(`${packageName}@${version} is already published; skipping npm publish.\n`);
  }

  if (!existingTagCommit) createAndPushTag(tag, githubSha);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
