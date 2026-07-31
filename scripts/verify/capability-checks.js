"use strict";

const crypto = require("crypto");
const { compareEngineeringTrees } = require("../check-upstream-drift");
const { runCapabilityFixture } = require("./capability-contract-runner");

const PINNED_COMMIT = "2ab958093e83e0ec752e6c1c5932da465bf23e0c";
const CATALOG_CONTRACT_SHA256 =
  "c5fe86282b712b3101c63273d80878195d8620f1def50c1609be1c01ee971667";
const CAPABILITY_COUNT = 17;
const MANIFEST_PATH = "scripts/upstream-capabilities.json";
const FIXTURE_PATH =
  "scripts/verify/fixtures/upstream-capability-contracts.json";

function parseDocument({ exists, read, fail, path }) {
  if (!exists(path)) {
    fail(`${path} is missing`);
    return null;
  }
  try {
    return JSON.parse(read(path));
  } catch (error) {
    fail(`${path} is invalid JSON: ${error.message}`);
    return null;
  }
}

function validateManifestHeader(manifest, fail) {
  if (manifest.schema_version !== 1) {
    fail("capability manifest schema_version must be 1");
  }
  if (manifest.upstream?.repository !== "https://github.com/mattpocock/skills") {
    fail("capability manifest should pin the mattpocock/skills repository");
  }
  if (manifest.upstream?.commit !== PINNED_COMMIT) {
    fail(`capability manifest should pin upstream commit ${PINNED_COMMIT}`);
  }
  if (manifest.upstream?.catalog !== "skills/engineering/README.md") {
    fail("capability manifest should name the upstream engineering catalog");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.upstream?.captured_at || "")) {
    fail("capability manifest should include its capture date");
  }
}

function validateCatalogContract(manifest, capabilities, fail) {
  if (capabilities.length !== CAPABILITY_COUNT) {
    fail(
      `capability manifest should contain ${CAPABILITY_COUNT} entries; ` +
        `found ${capabilities.length}`,
    );
  }
  const contract = capabilities
    .map(({ upstream_id, invocation }) => ({ upstream_id, invocation }))
    .sort((left, right) => left.upstream_id.localeCompare(right.upstream_id));
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(contract))
    .digest("hex");
  if (
    digest !== CATALOG_CONTRACT_SHA256 ||
    manifest.upstream?.catalog_contract_sha256 !== CATALOG_CONTRACT_SHA256
  ) {
    fail("capability ids or invocation modes drifted from the pinned catalog contract");
  }
}

function loadFixtures(context) {
  const document = parseDocument({ ...context, path: FIXTURE_PATH });
  if (!document) return null;
  const fixtures = new Map(
    (document.fixtures || []).map((fixture) => [fixture.upstream_id, fixture]),
  );
  if (document.schema_version !== 1 || fixtures.size !== CAPABILITY_COUNT) {
    context.fail(
      `capability fixture document should contain ${CAPABILITY_COUNT} unique entries`,
    );
  }
  return fixtures;
}

function validateCapabilityIdentity(capability, state) {
  const { fail, seen, localIds } = state;
  const upstreamId = capability.upstream_id;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(upstreamId || "")) {
    fail(`capability manifest contains invalid upstream id ${upstreamId}`);
    return false;
  }
  if (seen.has(upstreamId)) fail(`capability manifest repeats ${upstreamId}`);
  seen.add(upstreamId);
  if (!["user", "model"].includes(capability.invocation)) {
    fail(`${upstreamId} should declare user or model invocation`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(capability.local_id || "")) {
    fail(`${upstreamId} should have a stable local_id`);
  } else if (localIds.has(capability.local_id)) {
    fail(`${upstreamId} repeats local_id ${capability.local_id}`);
  } else {
    localIds.add(capability.local_id);
  }
  if (capability.parity_status !== "verified") {
    fail(`${upstreamId} parity_status should be verified`);
  }
  return true;
}

function validateExecutableContract({ capability, fixture, read, fail }) {
  const upstreamId = capability.upstream_id;
  const contract = capability.contract;
  const complete =
    contract?.normal_trigger &&
    contract.invalid_input &&
    contract.blocked_outcome &&
    Array.isArray(contract.allowed_differences) &&
    contract.allowed_differences.length > 0 &&
    contract.fixture;
  if (!complete) {
    fail(`${upstreamId} should declare a complete behavior contract`);
    return;
  }
  if (
    !fixture ||
    contract.fixture !== `${FIXTURE_PATH}#${upstreamId}`
  ) {
    fail(`${upstreamId} should reference its executable contract fixture`);
    return;
  }
  const results = runCapabilityFixture(capability, fixture, read);
  if (results.normal.outcome !== "ROUTE") {
    fail(`${upstreamId} normal fixture did not execute its declared entrypoint`);
  }
  if (
    results.invalid.outcome !== "INVALID_INPUT" ||
    !results.invalid.detail?.includes(fixture.invalid.outcome)
  ) {
    fail(`${upstreamId} invalid-input fixture did not execute its contract outcome`);
  }
  if (
    results.blocked.outcome !== "BLOCKED" ||
    !results.blocked.detail?.includes(fixture.blocked.outcome)
  ) {
    fail(`${upstreamId} blocked fixture did not execute its contract outcome`);
  }
  if (results.mutated.outcome !== "UNCLASSIFIED_INPUT") {
    fail(`${upstreamId} capability evaluator accepted a BANANA mutation`);
  }
  const magicTokens = [
    ...capability.entrypoints,
    ...capability.evidence.flatMap((proof) => [proof.path, ...proof.tokens]),
    fixture.invalid.outcome,
    fixture.blocked.outcome,
  ].join(" ");
  const stubbed = runCapabilityFixture(
    capability,
    fixture,
    () => magicTokens,
  );
  if (stubbed.normal.outcome !== "ENTRYPOINT_BEHAVIOR_MISSING") {
    fail(`${upstreamId} capability evaluator accepted a one-line magic-token stub`);
  }
  if (
    results.mislabelledNormal.outcome !== "INVALID_INPUT" ||
    results.mislabelledInvalid.outcome !== "ROUTE"
  ) {
    fail(`${upstreamId} capability evaluator trusted scenario labels over input`);
  }
  if (results.negatedNormal.outcome !== "UNCLASSIFIED_INPUT") {
    fail(`${upstreamId} capability evaluator ignored a negated normal request`);
  }
  const implicit =
    capability.invocation === "user" ? "EXPLICIT_INVOCATION_REQUIRED" : "ROUTE";
  if (results.implicitModelAttempt.outcome !== implicit) {
    fail(`${upstreamId} executable fixture violated invocation semantics`);
  }
  if (!contract.allowed_differences.includes(fixture.allowed_difference)) {
    fail(`${upstreamId} allowed-difference fixture is not declared`);
  }
}

function entrypointKinds(capability) {
  const find = (pattern) =>
    capability.entrypoints.find((item) => pattern.test(item));
  return {
    skill: find(/^skills\/[^/]+\/SKILL\.md$/),
    command: find(/^commands\/[^/]+\.md$/),
    agent: find(/^agents\/[^/]+\.md$/),
  };
}

function validateEntrypoints({ capability, context, kinds }) {
  const { exists, fail } = context;
  const upstreamId = capability.upstream_id;
  if (!Array.isArray(capability.entrypoints) || capability.entrypoints.length === 0) {
    fail(`${upstreamId} should declare at least one local entrypoint`);
    return false;
  }
  for (const entrypoint of capability.entrypoints) {
    if (!exists(entrypoint)) {
      fail(`${upstreamId} entrypoint ${entrypoint} is missing`);
    }
  }
  if (capability.invocation === "user" && !kinds.skill && !kinds.command) {
    fail(`${upstreamId} user-invoked mapping should expose a local skill or command`);
  }
  if (capability.invocation === "model" && !kinds.skill && !kinds.agent) {
    fail(`${upstreamId} model-invoked mapping should expose a local skill or agent`);
  }
  return true;
}

function validateSkillInvocation({ capability, context, skill }) {
  if (!skill) return;
  const { exists, read, fail } = context;
  const upstreamId = capability.upstream_id;
  const body = read(skill);
  const metadata = skill.replace(/SKILL\.md$/, "agents/openai.yaml");
  if (capability.invocation === "user") {
    if (!body.includes("disable-model-invocation: true")) {
      fail(`${upstreamId} local skill should block model invocation`);
    }
    if (!exists(metadata) || !read(metadata).includes("allow_implicit_invocation: false")) {
      fail(`${upstreamId} local metadata should block implicit invocation`);
    }
    return;
  }
  if (body.includes("disable-model-invocation: true")) {
    fail(`${upstreamId} local skill should allow model invocation`);
  }
  if (!exists(metadata)) {
    fail(`${upstreamId} local skill metadata is missing`);
  } else if (read(metadata).includes("allow_implicit_invocation: false")) {
    fail(`${upstreamId} local metadata should allow implicit invocation`);
  }
}

function validateEvidence({ capability, context, skill }) {
  const { fail, requireTokens } = context;
  const upstreamId = capability.upstream_id;
  if (!Array.isArray(capability.evidence) || capability.evidence.length === 0) {
    fail(`${upstreamId} should declare behavior evidence`);
    return;
  }
  for (const proof of capability.evidence) {
    if (!proof || !Array.isArray(proof.tokens) || proof.tokens.length === 0) {
      fail(`${upstreamId} has malformed behavior evidence`);
    } else {
      requireTokens(proof.path, proof.tokens);
    }
  }
  if (capability.contract?.quality_sections === true && skill) {
    requireTokens(skill, [
      "## When to Use",
      "## How It Works",
      "## Example",
      "## Exit",
    ]);
  }
}

function validateNoCanonicalShim({ capability, context }) {
  const { exists, fail } = context;
  const canonical = `skills/${capability.upstream_id}/SKILL.md`;
  if (
    capability.local_id !== capability.upstream_id &&
    exists(canonical) &&
    !capability.entrypoints.includes(canonical)
  ) {
    fail(
      `${capability.upstream_id} should not expose an extra canonical compatibility skill`,
    );
  }
}

function validateCapability({ capability, fixture, context, state }) {
  if (!validateCapabilityIdentity(capability, state)) return;
  const kinds = entrypointKinds(capability);
  if (!validateEntrypoints({ capability, context, kinds })) return;
  validateExecutableContract({
    capability,
    fixture,
    read: context.read,
    fail: context.fail,
  });
  validateSkillInvocation({ capability, context, skill: kinds.skill });
  validateEvidence({ capability, context, skill: kinds.skill });
  validateNoCanonicalShim({ capability, context });
}

function validateDriftComparator(fail) {
  const drift = compareEngineeringTrees(
    [
      { path: "skills/engineering/alpha/SKILL.md", type: "blob", sha: "old" },
      { path: "skills/engineering/removed/SKILL.md", type: "blob", sha: "removed" },
    ],
    [
      { path: "skills/engineering/alpha/SKILL.md", type: "blob", sha: "new" },
      { path: "skills/engineering/added/SKILL.md", type: "blob", sha: "added" },
    ],
  );
  const expected = {
    files: {
      added: ["skills/engineering/added/SKILL.md"],
      removed: ["skills/engineering/removed/SKILL.md"],
      changed: ["skills/engineering/alpha/SKILL.md"],
    },
    capabilities: {
      added: ["added"],
      removed: ["removed"],
      changed: ["alpha"],
    },
  };
  if (JSON.stringify(drift) !== JSON.stringify(expected)) {
    fail("upstream drift comparison should report deterministic changes");
  }
}

function runCapabilityChecks(context) {
  const manifest = parseDocument({ ...context, path: MANIFEST_PATH });
  const fixtures = loadFixtures(context);
  if (!manifest || !fixtures) return;
  validateManifestHeader(manifest, context.fail);
  const capabilities = Array.isArray(manifest.capabilities)
    ? manifest.capabilities
    : [];
  validateCatalogContract(manifest, capabilities, context.fail);
  const state = {
    fail: context.fail,
    seen: new Set(),
    localIds: new Set(),
  };
  for (const capability of capabilities) {
    validateCapability({
      capability,
      fixture: fixtures.get(capability.upstream_id),
      context,
      state,
    });
  }
  context.requireTokens("README.md", [
    PINNED_COMMIT,
    "17 项工程能力",
    MANIFEST_PATH,
  ]);
  validateDriftComparator(context.fail);
}

module.exports = { runCapabilityChecks };
