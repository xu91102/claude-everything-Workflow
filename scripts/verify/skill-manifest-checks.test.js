"use strict";

const assert = require("assert");
const { validateManifest } = require("./skill-manifest-checks");

function run() {
  const valid = {
    schemaVersion: 1,
    skills: [
      {
        name: "demo-skill",
        path: "skills/demo-skill/SKILL.md",
        owner: "skills/demo-skill/SKILL.md",
        version: "0.1.0",
        compatibility: ["claude-code", "codex"],
        allowedTools: null,
        invocation: "implicit",
      },
    ],
    ownership: [
      {
        id: "routing",
        owner: "skills/demo-skill/SKILL.md",
        surfaces: ["AGENTS.md"],
        enforcement: "advisory",
      },
    ],
  };

  assert.deepStrictEqual(validateManifest(valid, {
    exists: (file) => file === "skills/demo-skill/SKILL.md" || file === "AGENTS.md",
    skillPaths: ["skills/demo-skill/SKILL.md"],
    read: () => "---\nname: demo-skill\ndescription: demo\n---\n\n# Demo\n",
  }), []);

  const duplicate = structuredClone(valid);
  duplicate.skills.push({ ...duplicate.skills[0], name: "other", path: "skills/demo-skill/SKILL.md" });
  assert.match(validateManifest(duplicate, {
    exists: () => true,
    skillPaths: ["skills/demo-skill/SKILL.md"],
  }).join("\n"), /duplicate skill path/);

  const missingOwner = structuredClone(valid);
  missingOwner.ownership[0].owner = "rules/missing.md";
  assert.match(validateManifest(missingOwner, {
    exists: (file) => file === "skills/demo-skill/SKILL.md" || file === "AGENTS.md",
    skillPaths: ["skills/demo-skill/SKILL.md"],
  }).join("\n"), /owner path does not exist/);

  const unsafePath = structuredClone(valid);
  unsafePath.skills[0].path = "../outside/SKILL.md";
  assert.match(validateManifest(unsafePath, {
    exists: () => true,
    skillPaths: ["skills/demo-skill/SKILL.md"],
    read: () => "---\nname: demo-skill\ndescription: demo\n---\n",
  }).join("\n"), /unsafe skill path/);

  const missingSkill = structuredClone(valid);
  assert.match(validateManifest(missingSkill, {
    exists: (file) => file === "skills/demo-skill/SKILL.md" || file === "AGENTS.md",
    skillPaths: ["skills/demo-skill/SKILL.md", "skills/other/SKILL.md"],
    read: () => "---\nname: demo-skill\ndescription: demo\n---\n",
  }).join("\n"), /missing from manifest/);

  const duplicateOwner = structuredClone(valid);
  duplicateOwner.skills.push({ ...duplicateOwner.skills[0], name: "other", path: "skills/other/SKILL.md", owner: "skills/demo-skill/SKILL.md" });
  assert.match(validateManifest(duplicateOwner, {
    exists: () => true,
    skillPaths: ["skills/demo-skill/SKILL.md", "skills/other/SKILL.md"],
    read: (file) => `---\nname: ${file.includes("other") ? "other" : "demo-skill"}\ndescription: demo\n---\n`,
  }).join("\n"), /duplicate skill owner/);

  const policyConflict = structuredClone(valid);
  policyConflict.skills[0].invocation = "implicit";
  assert.match(validateManifest(policyConflict, {
    exists: (file) => file === "skills/demo-skill/SKILL.md" || file === "AGENTS.md" || file === "skills/demo-skill/agents/openai.yaml",
    skillPaths: ["skills/demo-skill/SKILL.md"],
    read: (file) => file.endsWith("openai.yaml")
      ? "allow_implicit_invocation: false\n"
      : "---\nname: demo-skill\ndescription: demo\n---\n",
  }).join("\n"), /conflicts with policy/);

  const explicitInvocationConflict = structuredClone(valid);
  explicitInvocationConflict.skills[0].invocation = "explicit-only";
  assert.match(validateManifest(explicitInvocationConflict, {
    exists: (file) => file === "skills/demo-skill/SKILL.md" || file === "AGENTS.md",
    skillPaths: ["skills/demo-skill/SKILL.md"],
    read: () => "---\nname: demo-skill\ndescription: demo\n---\n",
  }).join("\n"), /must disable implicit invocation/);

  const frontmatterPolicyConflict = structuredClone(valid);
  assert.match(validateManifest(frontmatterPolicyConflict, {
    exists: (file) => file === "skills/demo-skill/SKILL.md" || file === "AGENTS.md",
    skillPaths: ["skills/demo-skill/SKILL.md"],
    read: () => "---\nname: demo-skill\ndescription: demo\ndisable-model-invocation: true\n---\n",
  }).join("\n"), /conflicts with frontmatter/);

  const missingPath = structuredClone(valid);
  delete missingPath.skills[0].path;
  assert.doesNotThrow(() => validateManifest(missingPath, {
    exists: () => false,
    skillPaths: [],
  }));

  const versionConflict = structuredClone(valid);
  assert.match(validateManifest(versionConflict, {
    exists: (file) => file === "skills/demo-skill/SKILL.md" || file === "AGENTS.md",
    skillPaths: ["skills/demo-skill/SKILL.md"],
    read: () => "---\nname: demo-skill\ndescription: demo\nversion: 2.0.0\n---\n",
  }).join("\n"), /version does not match frontmatter/);

  console.log("skill manifest checks tests passed");
}

run();
