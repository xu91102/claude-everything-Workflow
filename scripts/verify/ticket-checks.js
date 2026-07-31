"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  frontier,
  parseTickets,
  validateGraph,
} = require("../../skills/to-tickets/scripts/ticket-state");

function validateCoverage(requirements, coverage, tickets) {
  const requirementSet = new Set(requirements);
  const ticketSet = new Set(tickets.map((ticket) => ticket.id));
  const coveredRequirements = new Set();
  const coveredTickets = new Set();

  for (const [requirement, ticketIds] of Object.entries(coverage)) {
    if (!requirementSet.has(requirement) || !Array.isArray(ticketIds)) {
      throw new Error(`invalid coverage entry ${requirement}`);
    }
    for (const ticketId of ticketIds) {
      if (!ticketSet.has(ticketId)) {
        throw new Error(`${requirement}: unknown ticket ${ticketId}`);
      }
      coveredRequirements.add(requirement);
      coveredTickets.add(ticketId);
    }
  }
  if (coveredRequirements.size !== requirementSet.size) {
    throw new Error("not every Spec requirement is covered");
  }
  if (coveredTickets.size !== ticketSet.size) {
    throw new Error("not every ticket maps to a Spec requirement");
  }
}

function evaluatePublish({
  approved,
  confirmed,
  requirements,
  coverage,
  tickets,
  artifact,
}) {
  if (!approved) {
    return { outcome: "BLOCKED_BY_UNAPPROVED_SPEC", artifact: null };
  }
  if (!confirmed) {
    return { outcome: "READY_FOR_TICKET_REVIEW", artifact: null };
  }
  validateGraph(tickets);
  validateCoverage(requirements, coverage, tickets);
  return { outcome: "TICKETS_PUBLISHED", artifact };
}

function semanticShape(tickets) {
  return tickets.map(({ id, title, source, outcome, blockers, acceptance }) => ({
    id,
    title,
    source,
    outcome,
    blockers,
    acceptance,
  }));
}

const COMBINED_FIXTURE = `
# Feature Tickets

## T01 — Establish the seam

**Parent / Source:** approved-spec.md

**What to build:** A verified end-to-end seam.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The seam is observable.

## T02 — Deliver behavior

**Parent / Source:** approved-spec.md

**What to build:** The user can complete the journey.

**Blocked by:** tickets/feature.md#T01

**Status:** ready-for-agent

- [ ] The journey passes.

## T03 — Contract cleanup

**Parent / Source:** approved-spec.md

**What to build:** The temporary compatibility path is removed.

**Blocked by:** tickets/feature.md#T02

**Status:** ready-for-agent

- [ ] The old path is absent.
`;

const PER_TICKET_FIXTURES = [
  `## T01 — Establish the seam

**Parent / Source:** approved-spec.md
**What to build:** A verified end-to-end seam.
**Blocked by:** None — can start immediately.
**Status:** ready-for-agent
- [ ] The seam is observable.
`,
  `## T02 — Deliver behavior

**Parent / Source:** approved-spec.md
**What to build:** The user can complete the journey.
**Blocked by:** tickets/feature/issues/T01-establish-seam.md
**Status:** ready-for-agent
- [ ] The journey passes.
`,
  `## T03 — Contract cleanup

**Parent / Source:** approved-spec.md
**What to build:** The temporary compatibility path is removed.
**Blocked by:** tickets/feature/issues/T02-deliver-behavior.md
**Status:** ready-for-agent
- [ ] The old path is absent.
`,
];

function loadValidFixtures() {
  const combined = parseTickets(COMBINED_FIXTURE, "combined");
  const perTicket = PER_TICKET_FIXTURES.flatMap((source, index) =>
    parseTickets(source, `per-ticket-${index + 1}`),
  );
  validateGraph(combined);
  validateGraph(perTicket);
  return { combined, perTicket };
}

function assertLayoutAndFrontier(combined, perTicket) {
  if (
    JSON.stringify(semanticShape(combined)) !==
    JSON.stringify(semanticShape(perTicket))
  ) {
    throw new Error("combined and per-ticket layouts are not equivalent");
  }
  if (JSON.stringify(frontier(combined)) !== JSON.stringify(["T01"])) {
    throw new Error("initial frontier is incorrect");
  }
  if (
    JSON.stringify(
      frontier(
        combined.map((ticket) =>
          ticket.id === "T01" ? { ...ticket, status: "complete" } : ticket,
        ),
      ),
    ) !==
    JSON.stringify(["T02"])
  ) {
    throw new Error("frontier after T01 is incorrect");
  }
}

function assertGateOutcomes(combined) {
  const requirements = ["R1", "R2", "R3"];
  const coverage = { R1: ["T01"], R2: ["T02"], R3: ["T03"] };
  const input = {
    requirements,
    coverage,
    tickets: combined,
    artifact: COMBINED_FIXTURE,
  };
  const unapproved = evaluatePublish({
    ...input,
    approved: false,
    confirmed: false,
  });
  const unconfirmed = evaluatePublish({
    ...input,
    approved: true,
    confirmed: false,
  });
  const published = evaluatePublish({
    ...input,
    approved: true,
    confirmed: true,
  });
  if (unapproved.artifact || unconfirmed.artifact) {
    throw new Error("an unapproved or unconfirmed draft was published");
  }
  if (
    unapproved.outcome !== "BLOCKED_BY_UNAPPROVED_SPEC" ||
    unconfirmed.outcome !== "READY_FOR_TICKET_REVIEW" ||
    published.outcome !== "TICKETS_PUBLISHED"
  ) {
    throw new Error("ticket gate outcomes are incorrect");
  }
}

function expectRejection(action, message) {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(message);
}

function assertAdversarialContracts(combined) {
  const cyclic = combined.map((ticket) => ({
    ...ticket,
    blockers: ticket.id === "T01" ? ["T03"] : ticket.blockers,
  }));
  expectRejection(() => validateGraph(cyclic), "cyclic graph was accepted");
  expectRejection(
    () => parseTickets("## T01 — Incomplete\n", "invalid"),
    "invalid ticket schema was accepted",
  );
  expectRejection(
    () => validateCoverage(["R1", "R2"], { R1: ["T01"] }, combined),
    "incomplete Spec coverage was accepted",
  );
  const detail = PER_TICKET_FIXTURES[0].replace(
    "A verified end-to-end seam.",
    "Edit src/example.js in Step 1.",
  );
  expectRejection(
    () => parseTickets(detail, "implementation-detail"),
    "ticket implementation detail was accepted",
  );
}

function loadTicketRuntime(root) {
  return require(path.join(
    root,
    "skills",
    "to-tickets",
    "scripts",
    "ticket-state.js",
  ));
}

function assertLocalTicketPersistence(runtime) {
  const numeric = runtime.parseTickets(
    PER_TICKET_FIXTURES[0].replaceAll("T01", "01"),
    "legacy-numeric",
  );
  if (numeric[0].id !== "01") {
    throw new Error("legacy numeric ticket ID was not accepted");
  }

  const initial = runtime.parseTickets(COMBINED_FIXTURE, "persistent");
  let acceptedBlockedTicket = false;
  try {
    runtime.setTicketStatus(
      COMBINED_FIXTURE,
      "T02",
      "in-progress",
      initial,
    );
    acceptedBlockedTicket = true;
  } catch {
    // Expected: T02 is not in the persisted frontier.
  }
  if (acceptedBlockedTicket) {
    throw new Error("persisted state accepted a non-frontier ticket");
  }
  const inProgress = runtime.setTicketStatus(
    COMBINED_FIXTURE,
    "T01",
    "in-progress",
  );
  const afterT01 = runtime.parseTickets(
    runtime.setTicketStatus(inProgress, "T01", "complete"),
    "persistent-after-T01",
  );
  if (
    JSON.stringify(runtime.frontier(initial)) !== JSON.stringify(["T01"]) ||
    JSON.stringify(runtime.frontier(afterT01)) !== JSON.stringify(["T02"])
  ) {
    throw new Error("persisted ticket state did not restore the frontier");
  }
  runtime.validateGraph(afterT01);
}

function validRemotePayload() {
  return {
    status_map: {
      open: "ready-for-agent",
      started: "in-progress",
      waiting: "blocked",
      closed: "complete",
    },
    tickets: [
      {
        id: "T01",
        title: "First",
        source: "remote#1",
        outcome: "Deliver first slice",
        blockers: [],
        remote_status: "closed",
        acceptance: ["First slice works"],
      },
      {
        id: "T02",
        title: "Second",
        source: "remote#2",
        outcome: "Deliver second slice",
        blockers: ["T01"],
        remote_status: "open",
        acceptance: ["Second slice works"],
      },
    ],
  };
}

function assertValidRemoteNormalization(runtime) {
  const remote = runtime.normalizeRemoteTickets(validRemotePayload());
  if (JSON.stringify(runtime.frontier(remote)) !== JSON.stringify(["T02"])) {
    throw new Error("remote tracker state did not normalize to the frontier");
  }
}

function assertInvalidRemoteScalarFields(runtime) {
  for (const invalidField of ["title", "source", "outcome"]) {
    const invalid = validRemotePayload();
    invalid.tickets = [
      {
        ...invalid.tickets[0],
        remote_status: "open",
        [invalidField]: { unexpected: true },
      },
    ];
    expectRejection(
      () => runtime.normalizeRemoteTickets(invalid),
      `remote tracker accepted non-string ${invalidField}`,
    );
  }
}

function assertInvalidRemoteArrays(runtime) {
  const invalidBlocker = validRemotePayload();
  invalidBlocker.tickets = [
    {
      ...invalidBlocker.tickets[0],
      remote_status: "open",
      blockers: [{}],
    },
  ];
  expectRejection(
    () => runtime.normalizeRemoteTickets(invalidBlocker),
    "remote tracker accepted a non-string blocker",
  );
  const invalidAcceptance = validRemotePayload();
  invalidAcceptance.tickets = [
    {
      ...invalidAcceptance.tickets[0],
      remote_status: "open",
      acceptance: [{}],
    },
  ];
  expectRejection(
    () => runtime.normalizeRemoteTickets(invalidAcceptance),
    "remote tracker accepted non-string acceptance",
  );
}

function assertPersistentTicketState(root) {
  const runtime = loadTicketRuntime(root);
  assertLocalTicketPersistence(runtime);
  assertValidRemoteNormalization(runtime);
  assertInvalidRemoteScalarFields(runtime);
  assertInvalidRemoteArrays(runtime);
}

function assertSddCompletion(recovery) {
  const finished = recovery.reconcileState({
    ticketStatus: "complete",
    ledgerStatus: "complete",
    ledgerPhase: "complete",
    commitPresent: true,
    base: "base-sha",
    head: "head-sha",
    commitBelongsToTicket: true,
  });
  if (finished.action !== "no-dispatch") {
    throw new Error("SDD recovery would redispatch a completed ticket");
  }
  const staleFinished = recovery.reconcileState({
    ticketStatus: "complete",
    ledgerStatus: "complete",
    ledgerPhase: "complete",
    commitPresent: true,
    base: "base-sha",
    head: "head-sha",
    commitBelongsToTicket: false,
  });
  if (staleFinished.action !== "BLOCKED") {
    throw new Error("SDD recovery trusted stale completion evidence");
  }
}

function assertSddActiveRecovery(recovery) {
  const conflict = recovery.reconcileState({
    ticketStatus: "in-progress",
    ledgerStatus: "complete",
    commitPresent: true,
  });
  if (conflict.action !== "BLOCKED") {
    throw new Error("SDD recovery did not block conflicting persisted state");
  }

  const review = recovery.reconcileState({
    ticketStatus: "in-progress",
    ledgerStatus: "in-progress",
    ledgerPhase: "review-pending",
    commitPresent: true,
    base: "base-sha",
    head: "head-sha",
    commitBelongsToTicket: true,
  });
  if (review.action !== "resume-review") {
    throw new Error("SDD recovery could not resume a persisted review phase");
  }
  const implementation = recovery.reconcileState({
    ticketStatus: "in-progress",
    ledgerStatus: "in-progress",
    ledgerPhase: "implementing",
    commitPresent: false,
  });
  if (implementation.action !== "resume-implementation") {
    throw new Error("SDD recovery could not resume persisted implementation");
  }
  const unknownCommit = recovery.reconcileState({
    ticketStatus: "in-progress",
    ledgerStatus: "in-progress",
    ledgerPhase: "review-pending",
    commitPresent: true,
    base: "base-sha",
    head: "head-sha",
    commitBelongsToTicket: false,
  });
  if (unknownCommit.action !== "BLOCKED") {
    throw new Error("SDD recovery trusted an unbound ticket commit");
  }
}

function assertSddInvalidMatrix(recovery) {
  const invalidLedgerStates = [
    {
      ticketStatus: "ready-for-agent",
      ledgerStatus: "ready-for-agent",
      ledgerPhase: "complete",
      commitPresent: false,
    },
    {
      ticketStatus: "ready-for-agent",
      ledgerStatus: "absent",
      ledgerPhase: "implementing",
      commitPresent: false,
    },
    {
      ticketStatus: "in-progress",
      ledgerStatus: "in-progress",
      ledgerPhase: "reviewing",
      commitPresent: false,
    },
    {
      ticketStatus: "in-progress",
      ledgerStatus: "in-progress",
      ledgerPhase: "implementing",
      commitPresent: true,
    },
    {
      ticketStatus: "complete",
      ledgerStatus: "complete",
      ledgerPhase: "reviewing",
      commitPresent: true,
    },
  ];
  for (const invalidState of invalidLedgerStates) {
    if (recovery.reconcileState(invalidState).action !== "BLOCKED") {
      throw new Error(
        `SDD recovery accepted inconsistent ledger state ${JSON.stringify(invalidState)}`,
      );
    }
  }
}

function assertSddRecovery(root) {
  const recovery = require(path.join(
    root,
    "skills",
    "subagent-driven-development",
    "scripts",
    "reconcile-state.js",
  ));
  assertSddCompletion(recovery);
  assertSddActiveRecovery(recovery);
  assertSddInvalidMatrix(recovery);
}

function assertAtomicTicketWrites(root) {
  const runtime = require(path.join(
    root,
    "skills",
    "to-tickets",
    "scripts",
    "ticket-state.js",
  ));
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "cew-ticket-atomic-"),
  );
  const artifact = path.join(directory, "tickets.md");
  fs.writeFileSync(artifact, COMBINED_FIXTURE);
  expectRejection(
    () =>
      runtime.writeFileAtomic(
        artifact,
        COMBINED_FIXTURE.replace(
          "**Status:** ready-for-agent",
          "**Status:** in-progress",
        ),
        () => {
          throw new Error("injected before rename");
        },
      ),
    "injected atomic ticket write did not fail",
  );
  if (fs.readFileSync(artifact, "utf8") !== COMBINED_FIXTURE) {
    throw new Error("failed atomic ticket write corrupted the original artifact");
  }
  const lock = `${artifact}.ticket-state.lock`;
  fs.writeFileSync(lock, "other writer\n");
  expectRejection(
    () => runtime.withFileLock(artifact, () => {}),
    "ticket-state accepted a concurrent writer",
  );
  fs.rmSync(lock, { force: true });
  fs.writeFileSync(
    lock,
    `${JSON.stringify({
      pid: 99999999,
      created_at: "2000-01-01T00:00:00.000Z",
      token: "stale-owner",
    })}\n`,
  );
  let recoveredStaleLock = false;
  runtime.withFileLock(artifact, () => {
    recoveredStaleLock = true;
  });
  if (!recoveredStaleLock || fs.existsSync(lock)) {
    throw new Error("ticket-state did not recover a dead-owner stale lock");
  }
  fs.writeFileSync(
    lock,
    `${JSON.stringify({
      pid: process.pid,
      created_at: new Date().toISOString(),
      token: "live-owner",
    })}\n`,
  );
  expectRejection(
    () => runtime.withFileLock(artifact, () => {}),
    "ticket-state reclaimed a live writer lock",
  );
  if (!fs.existsSync(lock)) {
    throw new Error("ticket-state removed another live writer lock");
  }
  fs.rmSync(lock, { force: true });
  fs.rmSync(directory, { recursive: true, force: true });
}

function runTicketChecks({ fail, requireTokens, root }) {
  requireTokens("skills/to-tickets/SKILL.md", [
    "BLOCKED_BY_UNAPPROVED_SPEC",
    "READY_FOR_TICKET_REVIEW",
    "combined",
    "per-ticket",
  ]);
  try {
    const { combined, perTicket } = loadValidFixtures();
    assertLayoutAndFrontier(combined, perTicket);
    assertGateOutcomes(combined);
    assertAdversarialContracts(combined);
    assertPersistentTicketState(root);
    assertSddRecovery(root);
    assertAtomicTicketWrites(root);
  } catch (error) {
    fail(`ticket contract verification failed: ${error.message}`);
  }
}

module.exports = {
  frontier,
  evaluatePublish,
  parseTickets,
  runTicketChecks,
  validateGraph,
  validateCoverage,
};
