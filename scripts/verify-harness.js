#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const errors = [];
const warnings = [];
const expectedCommands = [
  "code-review.md",
  "e2e.md",
  "evolve.md",
  "harness-audit.md",
  "instinct-status.md",
  "learn-eval.md",
  "pr.md",
  "prune.md",
  "tdd.md",
  "verify.md",
].sort();

function rel(...parts) {
  return path.join(root, ...parts);
}

function exists(file) {
  return fs.existsSync(rel(file));
}

function read(file) {
  return fs.readFileSync(rel(file), "utf8");
}

function walk(dir = "") {
  const base = rel(dir);
  if (!fs.existsSync(base)) return [];

  const out = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;

    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(child));
    } else {
      out.push(child.replace(/\\/g, "/"));
    }
  }
  return out;
}

function managedFiles() {
  const roots = [
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "settings.json",
    "commands",
    "agents",
    "skills/continuous-learning-v2",
    "skills/test-driven-development",
    "skills/e2e-testing",
    "skills/brainstorming",
    "skills/writing-plans",
    "skills/systematic-debugging",
    "hooks",
    "scripts",
    "rules",
  ];

  return roots.flatMap((item) => {
    const full = rel(item);
    if (!fs.existsSync(full)) return [];

    if (fs.statSync(full).isDirectory()) return walk(item);
    return [item];
  });
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function checkCommands() {
  const commandsDir = rel("commands");
  const commands = fs.existsSync(commandsDir)
    ? fs
        .readdirSync(commandsDir)
        .filter((file) => file.endsWith(".md"))
        .sort()
    : [];

  const listed = exists("README.md")
    ? Array.from(read("README.md").matchAll(/`\/([^`\s]+)`/g))
        .map((match) => `${match[1]}.md`)
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort()
    : expectedCommands;

  for (const file of listed) {
    if (!commands.includes(file)) {
      fail(
        `README lists /${file.replace(/\.md$/, "")} but commands/${file} is missing`,
      );
    }
  }

  for (const file of commands) {
    if (!listed.includes(file)) {
      fail(
        `commands/${file} exists but README does not list /${file.replace(/\.md$/, "")}`,
      );
    }
  }
}

function checkRouterTargets() {
  const expected = [
    ["commands/code-review.md", ["agents/code-reviewer.md"]],
    [
      "commands/tdd.md",
      ["agents/tdd-guide.md", "skills/test-driven-development/SKILL.md"],
    ],
    [
      "commands/e2e.md",
      ["agents/e2e-runner.md", "skills/e2e-testing/SKILL.md"],
    ],
    ["commands/harness-audit.md", ["agents/harness-optimizer.md"]],
  ];

  for (const [command, targets] of expected) {
    if (!exists(command)) {
      fail(`${command} is missing`);
      continue;
    }

    const body = read(command);
    for (const target of targets) {
      if (!exists(target)) {
        fail(`${command} references missing ${target}`);
      }

      const token = target
        .replace(/^agents\//, "")
        .replace(/^skills\//, "skills/")
        .replace(/\.md$/, "")
        .replace(/\/SKILL$/, "");

      if (!body.includes(token) && !body.includes(target)) {
        fail(`${command} should mention ${target}`);
      }
    }
  }
}

function checkSkillLinks() {
  const expected = [
    ["agents/e2e-runner.md", "skills/e2e-testing/SKILL.md"],
    ["agents/tdd-guide.md", "skills/test-driven-development/SKILL.md"],
  ];

  for (const [agent, skill] of expected) {
    if (!exists(agent)) fail(`${agent} is missing`);
    if (!exists(skill)) fail(`${skill} is missing`);
    if (exists(agent) && !read(agent).includes(skill)) {
      fail(`${agent} should reference ${skill}`);
    }
  }

  for (const agent of ["agents/harness-optimizer.md", "agents/planner.md"]) {
    if (!exists(agent)) {
      fail(`${agent} is missing`);
      continue;
    }

    if (!read(agent).includes("brainstorming")) {
      fail(`${agent} should reference brainstorming skill`);
    }
  }

  if (!exists("skills/writing-plans/SKILL.md")) {
    fail("skills/writing-plans/SKILL.md is missing");
  } else {
    const writingPlans = read("skills/writing-plans/SKILL.md");
    const requiredTokens = [
      "Project-Agent Loop",
      "agents/tdd-guide.md",
      "agents/code-reviewer.md",
      "skills/systematic-debugging/SKILL.md",
      "Completion Loop",
      "`/verify`",
      "`/pr`",
    ];

    for (const token of requiredTokens) {
      if (!writingPlans.includes(token)) {
        fail(`skills/writing-plans/SKILL.md should include ${token}`);
      }
    }

    for (const forbidden of [
      "superpowers:subagent-driven-development",
      "superpowers:executing-plans",
    ]) {
      if (writingPlans.includes(forbidden)) {
        fail(`skills/writing-plans/SKILL.md contains dangling ${forbidden}`);
      }
    }
  }

  if (!exists("skills/systematic-debugging/SKILL.md")) {
    fail("skills/systematic-debugging/SKILL.md is missing");
  } else {
    const debugging = read("skills/systematic-debugging/SKILL.md");
    for (const token of [
      "Phase 1: Root Cause Investigation",
      "Phase 2: Pattern Analysis",
      "Phase 3: Hypothesis Test",
      "Phase 4: Fix And Verify",
      "Return To Plan",
    ]) {
      if (!debugging.includes(token)) {
        fail(`skills/systematic-debugging/SKILL.md should include ${token}`);
      }
    }
  }
}

function checkRuleLoadingPolicy() {
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    if (!exists(file)) {
      fail(`${file} is missing`);
      continue;
    }

    const body = read(file);
    if (!body.includes("规则加载策略")) {
      fail(`${file} should include a rule loading policy section`);
    }
    if (!body.includes("不要默认全量加载 `rules/`")) {
      fail(`${file} should forbid loading all rules by default`);
    }
    if (!body.includes("~/.codex/rules/")) {
      fail(`${file} should mention Codex user-level rules fallback`);
    }
    if (!body.includes("~/.claude/rules/")) {
      fail(`${file} should mention Claude Code user-level rules fallback`);
    }
    if (!body.includes("不能把项目规则目录缺失等同于“无规则”")) {
      fail(`${file} should forbid treating a missing project rules directory as no rules`);
    }
  }

  if (!exists("rules/08-ecc-integration.md")) {
    fail("rules/08-ecc-integration.md is missing");
    return;
  }

  const ecc = read("rules/08-ecc-integration.md");
  if (!ecc.includes("触发矩阵")) {
    fail("rules/08-ecc-integration.md should include a trigger matrix");
  }
  if (!ecc.includes("不得因为“可能有用”而一次性读取完整 `rules/`")) {
    fail(
      "rules/08-ecc-integration.md should forbid full rules loading just because it might be useful",
    );
  }
}

function checkForbiddenCommandDrift() {
  const patterns = [
    [/\/docs\b/, "removed /docs command reference"],
    [/\/instinct-export\b/, "removed /instinct-export command reference"],
    [/\/instinct-import\b/, "removed /instinct-import command reference"],
    [/--decay\b/, "deprecated decay flag"],
    [/decay-confidence/, "deprecated decay-confidence script"],
    [/置信度降低 0\.02/, "automatic confidence decay"],
    [/超过.*天.*删除/, "time-based instinct deletion"],
    [/--max-age\b/, "time-based prune flag"],
    [/清理过期/, "expired-instinct cleanup wording"],
  ];

  for (const file of managedFiles()) {
    if (file === "scripts/verify-harness.js") continue;
    if (!/\.(md|json|js|ps1|sh)$/.test(file)) continue;

    const body = read(file);
    const lines = body.split(/\r?\n/);
    for (const [pattern, label] of patterns) {
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          fail(`${file}:${index + 1} contains ${label}: ${line.trim()}`);
        }
      });
    }
  }
}

function checkObserveV2() {
  const hook = rel("skills/continuous-learning-v2/hooks/observe-v2.js");
  const config = rel("skills/continuous-learning-v2/config.json");
  if (fs.existsSync(rel("hooks/observe.js"))) {
    fail("legacy hooks/observe.js should not exist; use observe-v2 only");
  }
  if (!fs.existsSync(hook)) return fail("observe-v2.js is missing");
  if (!fs.existsSync(config))
    return fail("continuous-learning-v2 config is missing");

  const tempHome = rel(".tmp-verify-harness");
  const tempConfigDir = path.join(
    tempHome,
    ".claude",
    "skills",
    "continuous-learning-v2",
  );
  const observationsPath = path.join(
    tempHome,
    ".claude",
    "homunculus",
    "observations.jsonl",
  );

  fs.rmSync(tempHome, { recursive: true, force: true });
  fs.mkdirSync(tempConfigDir, { recursive: true });

  const cfg = JSON.parse(fs.readFileSync(config, "utf8"));
  cfg.observation = cfg.observation || {};
  cfg.observation.enabled = true;
  cfg.observation.store_path = observationsPath;
  fs.writeFileSync(
    path.join(tempConfigDir, "config.json"),
    JSON.stringify(cfg, null, 2),
  );

  const input = JSON.stringify({
    tool: "Edit",
    cwd: root,
    tool_input: { file_path: "README.md" },
    session_id: "verify-harness",
  });

  const result = spawnSync(process.execPath, [hook, "post"], {
    cwd: root,
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
    },
    timeout: 10000,
  });

  if (result.error)
    fail(`observe-v2 smoke test failed: ${result.error.message}`);
  if (result.status !== 0)
    fail(`observe-v2 exited ${result.status}: ${result.stderr}`);
  if (!fs.existsSync(observationsPath)) {
    fail("observe-v2 did not write observations.jsonl");
  } else {
    const firstLine = fs
      .readFileSync(observationsPath, "utf8")
      .split(/\r?\n/)[0];
    try {
      const event = JSON.parse(firstLine);
      if (event.tool !== "Edit" || event.event !== "tool_complete") {
        fail("observe-v2 wrote unexpected observation payload");
      }
    } catch (err) {
      fail(`observe-v2 wrote invalid JSON: ${err.message}`);
    }
  }

  fs.rmSync(tempHome, { recursive: true, force: true });
}

function checkGitDiffWhitespace() {
  const isRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });

  if (isRepo.status !== 0) {
    return;
  }

  const result = spawnSync("git", ["diff", "--check"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });

  if (result.status !== 0) {
    fail(`git diff --check failed:\n${result.stdout}${result.stderr}`);
  } else if (result.stderr.trim()) {
    warn(result.stderr.trim());
  }
}

function main() {
  checkCommands();
  checkRouterTargets();
  checkSkillLinks();
  checkRuleLoadingPolicy();
  checkForbiddenCommandDrift();
  checkObserveV2();
  checkGitDiffWhitespace();

  if (warnings.length > 0) {
    console.error("Warnings:");
    warnings.forEach((item) => console.error(`- ${item}`));
  }

  if (errors.length > 0) {
    console.error("Harness verification failed:");
    errors.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log("Harness verification passed.");
}

main();
