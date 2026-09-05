"use strict";

const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = "harness/manifest.json";
const MAX_SKILL_LINES = 500;
const MAX_SKILL_TOKENS = 5000;
const MAX_DESCRIPTION_CHARS = 180;
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const COMPATIBILITIES = new Set(["claude-code", "codex"]);

function isSafeRelativePath(value) {
  return typeof value === "string" && value.length > 0 &&
    !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) &&
    !value.split(/[\\/]/).includes("..");
}

function parseFrontmatter(body) {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function validateManifest(manifest, { exists, skillPaths, read = () => "" }) {
  const errors = [];
  if (!manifest || manifest.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");
  if (!Array.isArray(manifest?.skills)) errors.push("manifest skills must be an array");
  if (!Array.isArray(manifest?.ownership)) errors.push("manifest ownership must be an array");
  if (!Array.isArray(manifest?.skills) || !Array.isArray(manifest?.ownership)) return errors;

  const declaredPaths = new Set();
  const declaredNames = new Set();
  const skillOwners = new Set();
  for (const skill of manifest.skills) {
    if (!skill || typeof skill !== "object") {
      errors.push("skill entry must be an object");
      continue;
    }
    for (const key of ["name", "path", "owner", "version", "compatibility", "allowedTools", "invocation"]) {
      if (!(key in skill)) errors.push(`skill ${skill.name || "<unknown>"} missing ${key}`);
    }
    if (!NAME_PATTERN.test(skill.name || "")) errors.push(`invalid skill name: ${skill.name || "<empty>"}`);
    if (declaredNames.has(skill.name)) errors.push(`duplicate skill name: ${skill.name}`);
    declaredNames.add(skill.name);
    if (declaredPaths.has(skill.path)) errors.push(`duplicate skill path: ${skill.path}`);
    declaredPaths.add(skill.path);
    if (skillOwners.has(skill.owner)) errors.push(`duplicate skill owner: ${skill.owner}`);
    skillOwners.add(skill.owner);
    const safeSkillPath = isSafeRelativePath(skill.path);
    const safeOwnerPath = isSafeRelativePath(skill.owner);
    if (!safeSkillPath) errors.push(`unsafe skill path: ${skill.name}`);
    if (!safeOwnerPath) errors.push(`unsafe skill owner: ${skill.name}`);
    const skillPathExists = safeSkillPath && exists(skill.path);
    const ownerPathExists = safeOwnerPath && exists(skill.owner);
    if (!skillPaths.includes(skill.path)) errors.push(`manifest skill path is not a Skill: ${skill.path}`);
    if (!skillPathExists) errors.push(`skill path does not exist: ${skill.path}`);
    if (!ownerPathExists) errors.push(`owner path does not exist: ${skill.owner}`);
    if (skill.owner !== skill.path) errors.push(`skill owner must equal Skill path: ${skill.name}`);
    if (!VERSION_PATTERN.test(skill.version || "")) errors.push(`invalid skill version for ${skill.name}: ${skill.version}`);
    if (!Array.isArray(skill.compatibility) || skill.compatibility.length === 0 || new Set(skill.compatibility).size !== skill.compatibility.length || skill.compatibility.some((item) => !COMPATIBILITIES.has(item))) errors.push(`invalid skill compatibility: ${skill.name}`);
    if (!(["implicit", "explicit-only"].includes(skill.invocation))) errors.push(`invalid invocation for ${skill.name}: ${skill.invocation}`);
    if (skill.allowedTools !== null && (!Array.isArray(skill.allowedTools) || skill.allowedTools.some((item) => typeof item !== "string"))) errors.push(`allowedTools must be null or an array of strings: ${skill.name}`);
    if (skillPathExists) {
      const body = read(skill.path);
      const frontmatter = parseFrontmatter(body);
      if (!frontmatter) errors.push(`Skill is missing frontmatter: ${skill.path}`);
      else if (frontmatter.name !== skill.name) errors.push(`manifest name does not match frontmatter: ${skill.path}`);
      const description = String(frontmatter?.description || "").trim();
      if (frontmatter && !description) errors.push(`Skill description is empty: ${skill.path}`);
      if (description.length > MAX_DESCRIPTION_CHARS) errors.push(`Skill description exceeds ${MAX_DESCRIPTION_CHARS} characters: ${skill.path}`);
      if (frontmatter?.version && frontmatter.version !== skill.version) errors.push(`manifest version does not match frontmatter: ${skill.path}`);
      const skillDir = path.posix.dirname(skill.path);
      const policyPath = `${skillDir}/agents/openai.yaml`;
      let disallowsImplicit = false;
      const frontmatterDisablesImplicit = frontmatter?.["disable-model-invocation"] === "true";
      if (exists(policyPath)) {
        const policy = read(policyPath);
        disallowsImplicit = /allow_implicit_invocation:\s*false\b/.test(policy);
        if (disallowsImplicit && skill.invocation !== "explicit-only") errors.push(`manifest invocation conflicts with policy: ${skill.name}`);
      }
      if (frontmatterDisablesImplicit && skill.invocation !== "explicit-only") {
        errors.push(`manifest invocation conflicts with frontmatter: ${skill.name}`);
      }
      if (skill.invocation === "explicit-only" && frontmatter?.["disable-model-invocation"] !== "true" && !disallowsImplicit) {
        errors.push(`explicit-only Skill must disable implicit invocation: ${skill.path}`);
      }
      const lineCount = body.split(/\r?\n/).length - (body.endsWith("\n") ? 1 : 0);
      const tokenCount = Math.ceil(body.length / 4);
      if (lineCount > MAX_SKILL_LINES) errors.push(`Skill exceeds ${MAX_SKILL_LINES} lines: ${skill.path} (${lineCount})`);
      if (tokenCount > MAX_SKILL_TOKENS) errors.push(`Skill exceeds approximately ${MAX_SKILL_TOKENS} tokens: ${skill.path} (${tokenCount})`);
    }
  }

  const actualSkillPaths = new Set(skillPaths);
  for (const skillPath of actualSkillPaths) if (!declaredPaths.has(skillPath)) errors.push(`Skill is missing from manifest: ${skillPath}`);
  for (const skillPath of declaredPaths) if (!actualSkillPaths.has(skillPath)) errors.push(`manifest lists missing Skill: ${skillPath}`);

  const ids = new Set();
  const responsibilityOwners = new Set();
  for (const entry of manifest.ownership) {
    if (!entry || typeof entry !== "object") {
      errors.push("ownership entry must be an object");
      continue;
    }
    for (const key of ["id", "owner", "surfaces", "enforcement"]) {
      if (!(key in entry)) errors.push(`ownership entry ${entry.id || "<unknown>"} missing ${key}`);
    }
    if (ids.has(entry.id)) errors.push(`duplicate ownership id: ${entry.id}`);
    ids.add(entry.id);
    if (responsibilityOwners.has(entry.owner)) errors.push(`duplicate responsibility owner: ${entry.owner}`);
    responsibilityOwners.add(entry.owner);
    if (!NAME_PATTERN.test(entry.id || "")) errors.push(`invalid ownership id: ${entry.id || "<empty>"}`);
    const safeOwnerPath = isSafeRelativePath(entry.owner);
    if (!safeOwnerPath) errors.push(`unsafe ownership owner: ${entry.id}`);
    const ownerPathExists = safeOwnerPath && exists(entry.owner);
    if (!ownerPathExists) errors.push(`owner path does not exist: ${entry.owner}`);
    if (!declaredPaths.has(entry.owner)) errors.push(`ownership owner must be a registered Skill: ${entry.id} -> ${entry.owner}`);
    if (!Array.isArray(entry.surfaces) || entry.surfaces.length === 0) errors.push(`ownership surfaces must be non-empty: ${entry.id}`);
    for (const surface of entry.surfaces || []) {
      if (!isSafeRelativePath(surface)) errors.push(`unsafe ownership surface: ${entry.id} -> ${surface}`);
      else if (!exists(surface)) errors.push(`ownership surface does not exist: ${entry.id} -> ${surface}`);
    }
    if (!["advisory", "blocking"].includes(entry.enforcement)) errors.push(`invalid enforcement for ${entry.id}: ${entry.enforcement}`);
  }
  return errors;
}

function runSkillManifestChecks(context) {
  const { exists, read, rel, fail } = context;
  if (!exists(MANIFEST_PATH)) return fail(`${MANIFEST_PATH} is missing`);
  let manifest;
  try {
    manifest = JSON.parse(read(MANIFEST_PATH));
  } catch (error) {
    return fail(`${MANIFEST_PATH} is invalid JSON: ${error.message}`);
  }
  const skillPaths = context.walk("skills").filter((file) => file.endsWith("/SKILL.md"));
  const errors = validateManifest(manifest, {
    exists,
    read,
    skillPaths,
  });
  for (const error of errors) fail(error);
}

module.exports = { MANIFEST_PATH, parseFrontmatter, validateManifest, runSkillManifestChecks };
