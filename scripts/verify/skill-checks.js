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
    "ticket-state.js",
    "in-progress",
    "complete",
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

function checkCompatibilitySkillSet() {
  for (const compatibilitySkill of [
    "discover-unknowns-zh",
    "find-skills",
    "skill-creator",
    "writing-plans",
    "executing-plans",
  ]) {
    if (!exists(`skills/${compatibilitySkill}/SKILL.md`)) {
      fail(`skills/${compatibilitySkill}/SKILL.md should provide a compatibility entrance`);
    }
  }

  requireTokens("skills/writing-plans/SKILL.md", [
    "compatibility",
    "to-tickets",
  ]);
  requireTokens("skills/executing-plans/SKILL.md", [
    "compatibility",
    "implement",
  ]);
  requireTokens("skills/discover-unknowns-zh/SKILL.md", [
    "compatibility",
    "iterative-retrieval",
  ]);
  requireTokens("skills/find-skills/SKILL.md", [
    "self-contained",
    "本仓库",
  ]);
  requireTokens("skills/skill-creator/SKILL.md", [
    "self-contained",
    "scripts/init_skill.py",
  ]);
  requireTokens("README.md", [
    "Skill 迁移说明",
    "`writing-plans` → `/to-tickets`",
    "`executing-plans` → `/implement`",
    "`discover-unknowns-zh` → `iterative-retrieval`",
    "`find-skills` 与 `skill-creator`",
    "至少一个发布周期",
  ]);
}

function listSkillNames() {
  return fs
    .readdirSync(rel("skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => exists(path.join("skills", name, "SKILL.md")))
    .sort();
}

function validateSkillFrontmatter({ name, skillPath, body }) {
  const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) {
    fail(`${skillPath} should contain YAML frontmatter`);
    return null;
  }
  const allowed = new Set([
    "name",
    "description",
    "disable-model-invocation",
  ]);
  for (const line of frontmatter[1].split(/\r?\n/)) {
    const key = line.match(/^([a-z-]+):/)?.[1];
    if (key && !allowed.has(key)) {
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
      fail(`${name} description should be at most 320 characters`);
    }
  }
  return frontmatter[1];
}

function validateSkillInvocation({ name, metadataPath, frontmatter }) {
  const isUserInvoked = frontmatter.includes("disable-model-invocation: true");
  const metadata = exists(metadataPath) ? read(metadataPath) : "";
  requireTokens(metadataPath, [
    "display_name:",
    "short_description:",
    "default_prompt:",
  ]);
  if (metadata && !metadata.includes(`$${name}`)) {
    fail(`${metadataPath} default_prompt should reference $${name}`);
  }
  const blocksImplicit = metadata.includes("allow_implicit_invocation: false");
  if (isUserInvoked !== blocksImplicit) {
    fail(`${name} should align invocation mode between skill and metadata`);
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

function validateOneSkill(name) {
  const skillPath = `skills/${name}/SKILL.md`;
  const metadataPath = `skills/${name}/agents/openai.yaml`;
  const body = read(skillPath);
  const lineCount = body.split(/\r?\n/).length;
  if (lineCount > 200) {
    fail(`${skillPath} should stay at or below 200 lines; found ${lineCount}`);
  }
  const frontmatter = validateSkillFrontmatter({ name, skillPath, body });
  if (frontmatter) {
    validateSkillInvocation({ name, metadataPath, frontmatter });
  }
  return lineCount;
}

function validateSkillReferences() {
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

function checkSkillQuality() {
  const names = listSkillNames();
  if (names.length < 29) {
    fail(`expected at least 29 skills; found ${names.length}`);
  }
  const totalLines = names.reduce(
    (total, name) => total + validateOneSkill(name),
    0,
  );
  if (totalLines > names.length * 75) {
    fail(
      `formal SKILL.md budget exceeded: ${totalLines} lines for ${names.length} skills`,
    );
  }
  validateSkillReferences();
}

function runSkillChecks(context) {
  bindContext(context);
  checkEngineeringMainline();
  checkMainlineOrdering();
  checkCompatibilitySkillSet();
  checkSkillQuality();
}

module.exports = { runSkillChecks };
