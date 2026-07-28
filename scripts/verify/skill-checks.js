"use strict";

const fs = require("fs");
const path = require("path");

let root;
let rel;
let exists;
let read;
let fail;
let requireTokens;

function bindContext(context) {
  ({ root, rel, exists, read, fail, requireTokens } = context);
}

function checkUserInvokedSkill(name) {
  const skill = `skills/${name}/SKILL.md`;
  const metadata = `skills/${name}/agents/openai.yaml`;

  requireTokens(skill, [
    `name: ${name}`,
    "disable-model-invocation: true",
  ]);
  requireTokens(metadata, [
    "display_name:",
    "short_description:",
    "policy:",
    "allow_implicit_invocation: false",
  ]);
}

function checkEngineeringMainline() {
  checkUserInvokedSkill("to-tickets");
  checkUserInvokedSkill("implement");

  requireTokens("skills/to-tickets/SKILL.md", [
    "tracer bullet",
    "Blocked by",
    "frontier",
    "combined",
    "per-ticket",
    "READY_FOR_TICKET_REVIEW",
  ]);
  requireTokens("skills/implement/SKILL.md", [
    "fresh context",
    "test-driven-development",
    "code-review",
    "verification-before-completion",
    "Do not commit",
  ]);
  requireTokens("commands/to-tickets.md", [
    "skills/to-tickets/SKILL.md",
    "唯一事实来源",
  ]);
  requireTokens("commands/implement.md", [
    "skills/implement/SKILL.md",
    "唯一事实来源",
  ]);
  requireTokens("skills/using-superpowers/SKILL.md", [
    "to-spec",
    "to-tickets",
    "implement",
    "frontier",
  ]);
  requireTokens("rules/01-base.md", [
    "Ticket Gate",
    "没有批准的 tickets 不进入实现",
  ]);
}

function checkMainlineOrdering() {
  if (!exists("skills/using-superpowers/SKILL.md")) return;

  const router = read("skills/using-superpowers/SKILL.md");
  const spec = router.indexOf("-> spec-gate");
  const tickets = router.indexOf("-> hand off to explicit /to-tickets");
  const implement = router.indexOf("-> implement one frontier ticket");

  if (spec === -1 || tickets === -1 || implement === -1) {
    fail("using-superpowers should include spec-gate, to-tickets, and implement");
    return;
  }
  if (!(spec < tickets && tickets < implement)) {
    fail("using-superpowers should order spec-gate before to-tickets before implement");
  }
}

function checkPrunedSkillSet() {
  for (const retired of [
    "discover-unknowns-zh",
    "find-skills",
    "skill-creator",
    "writing-plans",
    "executing-plans",
  ]) {
    if (exists(`skills/${retired}`)) {
      fail(`skills/${retired} should be retired`);
    }
  }

  requireTokens("skills/iterative-retrieval/SKILL.md", [
    "事实缺口",
    "盲点",
  ]);
  requireTokens("README.md", [
    "Skill 迁移说明",
    "`writing-plans` → `/to-tickets`",
    "`executing-plans` → `/implement`",
    "`discover-unknowns-zh` → `iterative-retrieval`",
    "`find-skills` → 宿主提供的 Skill 发现/安装能力",
    "`skill-creator` → 宿主提供的 Skill 创作能力",
  ]);
}

function checkSkillQuality() {
  const skillsDir = rel("skills");
  const names = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => exists(path.join("skills", name, "SKILL.md")))
    .sort();
  if (names.length !== 17) {
    fail(`expected 17 formal skills; found ${names.length}`);
  }

  let totalLines = 0;
  for (const name of names) {
    const skillPath = `skills/${name}/SKILL.md`;
    const metadataPath = `skills/${name}/agents/openai.yaml`;
    const body = read(skillPath);
    const lineCount = body.split(/\r?\n/).length;
    totalLines += lineCount;
    if (lineCount > 200) {
      fail(`${skillPath} should stay at or below 200 lines; found ${lineCount}`);
    }

    const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) {
      fail(`${skillPath} should contain YAML frontmatter`);
      continue;
    }

    const allowedFrontmatterKeys = new Set([
      "name",
      "description",
      "disable-model-invocation",
    ]);
    for (const line of frontmatter[1].split(/\r?\n/)) {
      const key = line.match(/^([a-z-]+):/)?.[1];
      if (key && !allowedFrontmatterKeys.has(key)) {
        fail(`${skillPath} contains unsupported frontmatter key ${key}`);
      }
    }

    const descriptionMatch = frontmatter[1].match(
      /^description:\s*(?:"([^"]*)"|'([^']*)'|(.+))$/m,
    );
    if (!descriptionMatch) {
      fail(`${skillPath} should have a one-line description`);
    } else {
      const description =
        descriptionMatch[1] ?? descriptionMatch[2] ?? descriptionMatch[3];
      if (description.length > 320) {
        fail(
          `${skillPath} description should be at most 320 characters; found ${description.length}`,
        );
      }
    }

    requireTokens(metadataPath, [
      "display_name:",
      "short_description:",
      "default_prompt:",
    ]);

    const isUserInvoked = frontmatter[1].includes(
      "disable-model-invocation: true",
    );
    const metadata = exists(metadataPath) ? read(metadataPath) : "";
    if (metadata && !metadata.includes(`$${name}`)) {
      fail(`${metadataPath} default_prompt should reference $${name}`);
    }
    const blocksImplicit = metadata.includes(
      "allow_implicit_invocation: false",
    );
    if (isUserInvoked !== blocksImplicit) {
      fail(
        `${name} should use the same invocation mode in SKILL.md and agents/openai.yaml`,
      );
    }

    const indexLine = read("skills/README.md")
      .split(/\r?\n/)
      .find((line) => line.startsWith(`- \`${name}\``));
    const indexMarksUserInvocation =
      indexLine?.includes("user-invoked") ?? false;
    if (isUserInvoked !== indexMarksUserInvocation) {
      fail(`${name} invocation mode should match skills/README.md`);
    }
  }

  const budget = Math.floor(2712 * 0.75);
  if (totalLines > budget) {
    fail(
      `formal SKILL.md budget should be at most ${budget} lines; found ${totalLines}`,
    );
  }

  requireTokens("skills/e2e-testing/SKILL.md", [
    "references/playwright-patterns.md",
  ]);
  requireTokens("skills/subagent-driven-development/SKILL.md", [
    "references/implementer-prompt.md",
    "references/ticket-reviewer-prompt.md",
  ]);
  for (const reference of [
    "skills/e2e-testing/references/playwright-patterns.md",
    "skills/subagent-driven-development/references/implementer-prompt.md",
    "skills/subagent-driven-development/references/ticket-reviewer-prompt.md",
  ]) {
    if (!exists(reference)) fail(`${reference} is missing`);
  }
}

function runSkillChecks(context) {
  bindContext(context);
  checkEngineeringMainline();
  checkMainlineOrdering();
  checkPrunedSkillSet();
  checkSkillQuality();
}

module.exports = { runSkillChecks };
