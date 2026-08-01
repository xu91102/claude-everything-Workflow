#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relative), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sorted(values) {
  return [...values].sort();
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function parseArgs(argv) {
  if (argv.length === 0) return null;
  if (argv.length !== 2 || argv[0] !== "--upstream-root") {
    throw new Error(
      "Usage: node scripts/verify-upstream-capability-map.js " +
        "[--upstream-root <mattpocock-skills-clone>]",
    );
  }
  return path.resolve(argv[1]);
}

function validatePinnedInventory(manifest, baseline) {
  assert(baseline.schema_version === 1, "invalid baseline schema");
  assert(
    baseline.repository === manifest.upstream.repository &&
      baseline.commit === manifest.upstream.commit,
    "baseline and capability map pin different upstream snapshots",
  );
  const mapped = sorted(manifest.capabilities.map((entry) => entry.upstream));
  const recorded = sorted(Object.keys(baseline.engineering || {}));
  assert(
    JSON.stringify(mapped) === JSON.stringify(recorded),
    "baseline and capability map have different Engineering inventories",
  );
  assert(
    /^[0-9a-f]{64}$/.test(
      baseline.support_dependencies?.["productivity/handoff"] || "",
    ),
    "baseline is missing the handoff source hash",
  );
  for (const [name, hash] of Object.entries(baseline.engineering)) {
    assert(/^[0-9a-f]{64}$/.test(hash), `invalid source hash for ${name}`);
  }
}

function engineeringInventory(upstreamRoot) {
  const directory = path.join(upstreamRoot, "skills", "engineering");
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => {
      const skill = path.join(directory, entry.name, "SKILL.md");
      return entry.isDirectory() && fs.existsSync(skill);
    })
    .map((entry) => entry.name);
}

function verifyClone(upstreamRoot, manifest, baseline) {
  const head = execFileSync("git", ["-C", upstreamRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  assert(head === manifest.upstream.commit, `upstream clone is at ${head}`);
  const actual = sorted(engineeringInventory(upstreamRoot));
  const expected = sorted(Object.keys(baseline.engineering));
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    "upstream Engineering inventory differs from the pinned baseline",
  );
  for (const [name, expectedHash] of Object.entries(baseline.engineering)) {
    const file = path.join(upstreamRoot, "skills", "engineering", name, "SKILL.md");
    assert(sha256(file) === expectedHash, `upstream source changed: ${name}`);
  }
  const handoff = path.join(
    upstreamRoot,
    "skills",
    "productivity",
    "handoff",
    "SKILL.md",
  );
  assert(
    sha256(handoff) === baseline.support_dependencies["productivity/handoff"],
    "upstream source changed: productivity/handoff",
  );
}

function main(argv = process.argv.slice(2)) {
  const upstreamRoot = parseArgs(argv);
  const manifest = readJson("scripts/upstream-capability-map.json");
  const baseline = readJson("scripts/upstream-capability-baseline.json");
  validatePinnedInventory(manifest, baseline);
  if (upstreamRoot) verifyClone(upstreamRoot, manifest, baseline);
  process.stdout.write(
    `Verified upstream ${manifest.upstream.commit.slice(0, 7)}: ` +
      `${manifest.capabilities.length} Engineering capabilities + handoff\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
}
