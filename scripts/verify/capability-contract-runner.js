"use strict";

const INPUT_CLASSIFIERS = {
  "ask-matt": {
    normal: /which engineering flow fits/i,
    invalid: /no engineering goal/i,
    blocked: /choose the next explicit flow for me/i,
  },
  "grill-with-docs": {
    normal: /grill this design and update our glossary/i,
    invalid: /no domain decision exists/i,
    blocked: /write unresolved options as facts/i,
  },
  triage: {
    normal: /triage external issue/i,
    invalid: /internally generated ticket/i,
    blocked: /conflicting labels without approval/i,
  },
  "improve-codebase-architecture": {
    normal: /deepening opportunities in recent hotspots/i,
    invalid: /no evidence-backed architecture candidate/i,
    blocked: /select product semantics during an audit/i,
  },
  "setup-matt-pocock-skills": {
    normal: /configure tracker, domain docs, adr and triage roles/i,
    invalid: /existing configuration needs no change/i,
    blocked: /persist unconfirmed tracker settings/i,
  },
  "to-spec": {
    normal: /turn this conversation into an engineering spec/i,
    invalid: /narrow typo fix as a formal spec/i,
    blocked: /draft despite unresolved public contract policy/i,
  },
  "to-tickets": {
    normal: /split this approved spec into tracer-bullet tickets/i,
    invalid: /formal tickets from an unapproved spec/i,
    blocked: /publish before ticket graph review/i,
  },
  implement: {
    normal: /implement the approved ticket set/i,
    invalid: /multi-session spec with no tickets/i,
    blocked: /start a non-frontier ticket/i,
  },
  wayfinder: {
    normal: /map decisions for a multi-session/i,
    invalid: /map for a one-session clear task/i,
    blocked: /resolve a hitl decision without a human/i,
  },
  prototype: {
    normal: /prototype this order state model/i,
    invalid: /build without a design question/i,
    blocked: /run without an available runtime/i,
  },
  "diagnosing-bugs": {
    normal: /diagnose this intermittent performance regression/i,
    invalid: /fix before reproducing/i,
    blocked: /patch an untested hypothesis/i,
  },
  research: {
    normal: /research this api against first-party sources/i,
    invalid: /fact already proven locally/i,
    blocked: /sources are unreachable/i,
  },
  tdd: {
    normal: /build this behavior red-green-refactor/i,
    invalid: /production tests to a throwaway prototype/i,
    blocked: /behavior code without a red test/i,
  },
  "domain-modeling": {
    normal: /define a new subscription lifecycle invariant/i,
    invalid: /rename an internal helper with unchanged domain/i,
    blocked: /choose unresolved product semantics/i,
  },
  "codebase-design": {
    normal: /design a deep payment authorization interface/i,
    invalid: /seam for a hypothetical adapter/i,
    blocked: /unresolved domain responsibility/i,
  },
  "code-review": {
    normal: /review this diff from .* against the spec/i,
    invalid: /review without a fixed point or diff/i,
    blocked: /invent requirements when no spec exists/i,
  },
  "resolving-merge-conflicts": {
    normal: /resolve this in-progress rebase/i,
    invalid: /git has no conflict/i,
    blocked: /incompatible product intents/i,
  },
};

function classifyCapabilityInput(upstreamId, input) {
  if (typeof input !== "string" || input.trim().length === 0) {
    return "UNCLASSIFIED_INPUT";
  }
  const classifier = INPUT_CLASSIFIERS[upstreamId];
  if (!classifier) return "MISSING_CLASSIFIER";
  const matches = Object.entries(classifier)
    .filter(([, pattern]) => pattern.test(input))
    .map(([state]) => state);
  if (matches.includes("normal") && /\b(?:do not|don't|never)\b/i.test(input)) {
    return "UNCLASSIFIED_INPUT";
  }
  return matches.length === 1 ? matches[0] : "UNCLASSIFIED_INPUT";
}

function evaluateCapabilityScenario(capability, scenario) {
  if (!capability || !scenario || typeof scenario !== "object") {
    throw new Error("capability and scenario are required");
  }
  if (scenario.caller === "model" && capability.invocation === "user") {
    return {
      outcome: "EXPLICIT_INVOCATION_REQUIRED",
      local_id: capability.local_id,
    };
  }
  const state = classifyCapabilityInput(capability.upstream_id, scenario.input);
  if (state === "invalid") {
    return { outcome: "INVALID_INPUT", detail: capability.contract.invalid_input };
  }
  if (state === "blocked") {
    return { outcome: "BLOCKED", detail: capability.contract.blocked_outcome };
  }
  if (state !== "normal") return { outcome: state };
  if (!capability.entrypoints.includes(scenario.entrypoint)) {
    return {
      outcome: "ENTRYPOINT_NOT_DECLARED",
      entrypoint: scenario.entrypoint,
    };
  }
  return {
    outcome: "ROUTE",
    entrypoint: scenario.entrypoint,
    local_id: capability.local_id,
  };
}

function executeDocumentedScenario({
  capability,
  entrypointBodies,
  behaviorMissing,
  scenario,
}) {
  const result = evaluateCapabilityScenario(capability, {
    ...scenario,
    caller: capability.invocation,
  });
  if (result.outcome === "ROUTE") {
    if (behaviorMissing) {
      return {
        outcome: "ENTRYPOINT_BEHAVIOR_MISSING",
        detail: behaviorMissing,
      };
    }
    const source = entrypointBodies.find(
      (item) => item.entrypoint === result.entrypoint,
    );
    return source?.body.trim()
      ? { ...result, scenario_input: scenario.input }
      : { outcome: "ENTRYPOINT_NOT_EXECUTABLE" };
  }
  const source = entrypointBodies.find((item) =>
    item.body.includes(scenario.outcome),
  );
  if (!source) {
    return {
      outcome: "ENTRYPOINT_CONTRACT_MISSING",
      expected: scenario.outcome,
    };
  }
  return {
    ...result,
    contract_source: source.entrypoint,
    scenario_input: scenario.input,
  };
}

function findMissingBehavior(capability, entrypointBodies, readEntrypoint) {
  for (const { entrypoint, body } of entrypointBodies) {
    const lines = body.split(/\r?\n/);
    if (
      lines.length < 8 ||
      !body.startsWith("---") ||
      !/^#\s+\S/m.test(body)
    ) {
      return `${entrypoint} is not a complete prompt document`;
    }
  }
  for (const proof of capability.evidence || []) {
    const body = readEntrypoint(proof.path);
    const missingToken = proof.tokens.find((token) => !body.includes(token));
    if (missingToken) return `${proof.path} lacks ${missingToken}`;
    const lines = body.split(/\r?\n/);
    const evidenceLines = new Set(
      proof.tokens.map((token) =>
        lines.findIndex((line) => line.includes(token)),
      ),
    );
    if (evidenceLines.size < 2) {
      return `${proof.path} collapses behavior evidence into one line`;
    }
    const reachable =
      capability.entrypoints.includes(proof.path) ||
      entrypointBodies.some((item) => item.body.includes(proof.path));
    if (!reachable) return `${proof.path} is not reachable from an entrypoint`;
  }
  return null;
}

function runCapabilityFixture(capability, fixture, readEntrypoint) {
  if (typeof readEntrypoint !== "function") {
    throw new Error("readEntrypoint is required");
  }
  const entrypointBodies = capability.entrypoints.map((entrypoint) => ({
    entrypoint,
    body: readEntrypoint(entrypoint),
  }));
  const behaviorMissing = findMissingBehavior(
    capability,
    entrypointBodies,
    readEntrypoint,
  );
  const execute = (scenario) =>
    executeDocumentedScenario({
      capability,
      entrypointBodies,
      behaviorMissing,
      scenario,
    });
  return {
    normal: execute(fixture.normal),
    invalid: execute(fixture.invalid),
    blocked: execute(fixture.blocked),
    mutated: evaluateCapabilityScenario(capability, {
      caller: capability.invocation,
      entrypoint: fixture.normal.entrypoint,
      input: "BANANA unrelated mutation",
    }),
    mislabelledNormal: evaluateCapabilityScenario(capability, {
      caller: capability.invocation,
      entrypoint: fixture.normal.entrypoint,
      input: fixture.invalid.input,
    }),
    mislabelledInvalid: evaluateCapabilityScenario(capability, {
      caller: capability.invocation,
      entrypoint: fixture.normal.entrypoint,
      input: fixture.normal.input,
    }),
    negatedNormal: evaluateCapabilityScenario(capability, {
      caller: capability.invocation,
      entrypoint: fixture.normal.entrypoint,
      input: `Do not ${fixture.normal.input}`,
    }),
    implicitModelAttempt: evaluateCapabilityScenario(capability, {
      caller: "model",
      entrypoint: fixture.normal.entrypoint,
      input: fixture.normal.input,
    }),
  };
}

module.exports = {
  classifyCapabilityInput,
  evaluateCapabilityScenario,
  runCapabilityFixture,
};
