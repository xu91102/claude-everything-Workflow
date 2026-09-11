"use strict";

const assert = require("node:assert/strict");
const { validateManifest, validateNativeRoutes } = require("./skill-manifest-checks");

function validate(compatibility, invocation, claudeFlag, policy) {
  const skillPath = "skills/demo/SKILL.md";
  const policyPath = "skills/demo/agents/openai.yaml";
  const body = "---\nname: demo\ndescription: Invocation fixture\n" +
    (typeof claudeFlag === "string" ? claudeFlag : claudeFlag ? "disable-model-invocation: true\n" : "") + "---\n";
  return validateManifest({
    schemaVersion: 1,
    skills: [{ name: "demo", path: skillPath, owner: skillPath, version: "0.1.0",
      compatibility, allowedTools: null, invocation }],
    ownership: [],
  }, {
    exists: (file) => file === skillPath || (file === policyPath && policy !== undefined),
    read: (file) => file === skillPath ? body : policy,
    skillPaths: [skillPath],
  }).join("\n");
}

const both = ["claude-code", "codex"];
const disabledPolicy = "policy:\n  allow_implicit_invocation: false\n";
assert.match(validate(both, "explicit-only", true), /codex.*disable implicit invocation/i);
assert.match(validate(both, "explicit-only", false, disabledPolicy), /claude-code.*disable implicit invocation/i);
assert.equal(validate(both, "explicit-only", true, disabledPolicy), "");
assert.equal(validate(["claude-code"], "explicit-only", true), "");
assert.equal(validate(["codex"], "explicit-only", false, disabledPolicy), "");
assert.match(validate(["codex"], "explicit-only", false,
  "interface:\n  allow_implicit_invocation: false\n"), /codex.*disable implicit invocation/i);
assert.match(validate(both, "implicit", true), /conflicts with frontmatter/);
assert.match(validate(both, "implicit", false, disabledPolicy), /conflicts with policy/);
assert.equal(validate(both, "implicit", false), "");
assert.equal(validate(both, "explicit-only", true, disabledPolicy.replace(/\n/g, "\r\n")), "");
for (const policy of [
  "policy: # native invocation policy\n  allow_implicit_invocation: false\n",
  "policy:\n    allow_implicit_invocation: false\n",
  "policy:\n\n  # invocation gate\n  allow_implicit_invocation: false\n",
  "policy: { allow_implicit_invocation: false }\n",
  "'policy':\n  'allow_implicit_invocation': false\n",
]) {
  assert.match(validate(both, "implicit", false, policy), /conflicts with policy/);
  assert.equal(validate(both, "explicit-only", true, policy), "");
}
for (const policy of [
  "policy:\n  allow_implicit_invocation: 'false'\n",
  "policy:\n  allow_implicit_invocation: false\n  allow_implicit_invocation: true\n",
  "policy: [\n",
]) {
  assert.match(validate(both, "implicit", false, policy), /invalid.*yaml|must be.*boolean/i);
}
assert.equal(validate(both, "implicit", false,
  "policy:\n  nested:\n    allow_implicit_invocation: false\n"), "");
for (const flag of [
  "disable-model-invocation: true # user-only\n",
  "'disable-model-invocation': true\n",
]) {
  assert.match(validate(both, "implicit", flag), /conflicts with frontmatter/);
  assert.equal(validate(both, "explicit-only", flag, disabledPolicy), "");
}
assert.match(validate(both, "implicit", "disable-model-invocation: 'true'\n"), /must be.*boolean/);
const routes = { skills: [{ name: "handoff", path: "skills/handoff/SKILL.md", invocation: "explicit-only" }] };
assert.match(validateNativeRoutes(routes, "  -> fresh session? -> skills/handoff/SKILL.md\n").join("\n"), /native-entry/);
assert.match(validateNativeRoutes(routes, "  -> fresh session? -> handoff\n").join("\n"), /native-entry/);
assert.deepEqual(validateNativeRoutes(routes, "  -> fresh session? -> native-entry skills/handoff/SKILL.md\n"), []);
assert.deepEqual(validateNativeRoutes(routes, "  -> delivery -> skills/implement/SKILL.md\n"), []);
// Natural-language requests must remain selectable on both hosts after an upgrade.
const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");
const root = path.resolve(__dirname, "../..");
const manifest = require("../../harness/manifest.json");
for (const name of ["handoff", "improve-codebase-architecture", "triage"]) {
  const entry = manifest.skills.find((skill) => skill.name === name);
  assert.equal(entry?.invocation, "implicit", name);
  const body = fs.readFileSync(path.join(root, entry.path), "utf8");
  const frontmatter = YAML.parse(body.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  assert.notEqual(frontmatter["disable-model-invocation"], true, name);
  const policy = YAML.parse(fs.readFileSync(path.join(root, "skills", name, "agents/openai.yaml"), "utf8"));
  assert.equal(policy.policy.allow_implicit_invocation, true, name);
}
for (const name of ["research", "wayfinder", "find-skills", "project-context"]) {
  assert.equal(manifest.skills.some((skill) => skill.name === name), false);
}
console.log("Skill invocation tests passed (33 host-gate scenarios, three natural-language entries, four retired skills).");
