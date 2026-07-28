"use strict";

function parseTickets(source, label) {
  const headings = [...source.matchAll(/^##\s+([A-Z]+\d+)\s+—\s+(.+)$/gm)];
  if (headings.length === 0) {
    throw new Error(`${label}: no ticket headings`);
  }

  return headings.map((heading, index) => {
    const body = source.slice(
      heading.index,
      headings[index + 1]?.index ?? source.length,
    );
    const field = (name) => {
      const match = body.match(
        new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.+)$`, "m"),
      );
      if (!match || !match[1].trim()) {
        throw new Error(`${label}#${heading[1]}: missing ${name}`);
      }
      return match[1].trim();
    };
    const blockedBy = field("Blocked by");
    const blockers = /^None\b/.test(blockedBy)
      ? []
      : blockedBy
          .split(",")
          .map((value) => parseBlockerRef(value, label, heading[1]));
    const acceptance = [...body.matchAll(/^- \[ \] (.+)$/gm)].map(
      (match) => match[1].trim(),
    );
    if (acceptance.length === 0) {
      throw new Error(`${label}#${heading[1]}: missing acceptance criteria`);
    }
    if (body.includes("```")) {
      throw new Error(`${label}#${heading[1]}: implementation code is forbidden`);
    }

    const ticket = {
      id: heading[1],
      title: heading[2].trim(),
      source: field("Parent / Source"),
      outcome: field("What to build"),
      blockers,
      status: field("Status"),
      acceptance,
    };
    validateTicketContent(ticket, label);
    return ticket;
  });
}

function parseBlockerRef(value, label, ticketId) {
  const reference = value.trim();
  const match =
    reference.match(/^([A-Z]+\d+)$/) ||
    reference.match(/#([A-Z]+\d+)$/) ||
    reference.match(/[/\\]([A-Z]+\d+)(?:-[^/\\]+)?\.md$/);
  if (!match) {
    throw new Error(`${label}#${ticketId}: invalid blocker ${reference}`);
  }
  return match[1];
}

function validateTicketContent(ticket, label) {
  const content = [ticket.outcome, ...ticket.acceptance].join("\n");
  const forbidden = [
    /(?:^|\s)(?:src|lib|app|scripts|skills)\/[\w./-]+/,
    /\b(?:step|步骤)\s*\d+/i,
    /\b\d+\s*(?:minutes?|分钟)\b/i,
    /\b(?:interface|files?)\s*:/i,
    /\b(?:const|function|class)\s+\w+/,
  ];
  if (forbidden.some((pattern) => pattern.test(content))) {
    throw new Error(`${label}#${ticket.id}: implementation detail is forbidden`);
  }
}

function validateGraph(tickets) {
  const byId = new Map();
  for (const ticket of tickets) {
    if (byId.has(ticket.id)) throw new Error(`duplicate ticket ${ticket.id}`);
    if (ticket.status !== "ready-for-agent") {
      throw new Error(`${ticket.id}: invalid status ${ticket.status}`);
    }
    byId.set(ticket.id, ticket);
  }

  for (const ticket of tickets) {
    for (const blocker of ticket.blockers) {
      if (!byId.has(blocker)) {
        throw new Error(`${ticket.id}: unknown blocker ${blocker}`);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error(`cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const blocker of byId.get(id).blockers) visit(blocker);
    visiting.delete(id);
    visited.add(id);
  }
  for (const ticket of tickets) visit(ticket.id);
}

function frontier(tickets, completed = new Set()) {
  return tickets
    .filter(
      (ticket) =>
        !completed.has(ticket.id) &&
        ticket.blockers.every((blocker) => completed.has(blocker)),
    )
    .map((ticket) => ticket.id);
}

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
    JSON.stringify(frontier(combined, new Set(["T01"]))) !==
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

function runTicketChecks({ fail, requireTokens }) {
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
