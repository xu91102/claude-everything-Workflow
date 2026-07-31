#!/usr/bin/env node
"use strict";

const fs = require("fs");

const TICKET_STATUSES = new Set([
  "ready-for-agent",
  "in-progress",
  "blocked",
  "complete",
]);
const LEDGER_STATUSES = new Set([
  "absent",
  "ready-for-agent",
  "in-progress",
  "blocked",
  "complete",
]);
const LEDGER_PHASES = new Set([
  "absent",
  "implementing",
  "review-pending",
  "reviewing",
  "complete",
]);
const ALLOWED_PHASES = {
  absent: new Set(["absent"]),
  "ready-for-agent": new Set(["absent"]),
  "in-progress": new Set(["implementing", "review-pending", "reviewing"]),
  blocked: new Set(["absent", "implementing", "review-pending", "reviewing"]),
  complete: new Set(["complete"]),
};

function validateRecoveryState(state) {
  const {
    ticketStatus,
    ledgerStatus,
    ledgerPhase,
    commitPresent,
  } = state;
  if (
    !TICKET_STATUSES.has(ticketStatus) ||
    !LEDGER_STATUSES.has(ledgerStatus) ||
    !LEDGER_PHASES.has(ledgerPhase) ||
    typeof commitPresent !== "boolean"
  ) {
    throw new Error("invalid SDD recovery state");
  }
  if (!ALLOWED_PHASES[ledgerStatus].has(ledgerPhase)) {
    return {
      action: "BLOCKED",
      reason: "ledger status and phase are inconsistent",
    };
  }
  const commitPhases = new Set(["review-pending", "reviewing", "complete"]);
  if (
    (commitPresent && !commitPhases.has(ledgerPhase)) ||
    (!commitPresent && commitPhases.has(ledgerPhase))
  ) {
    return {
      action: "BLOCKED",
      reason: "ledger phase and commit presence are inconsistent",
    };
  }
  return null;
}

function hasBoundCommit(state) {
  return (
    state.commitPresent &&
    typeof state.base === "string" &&
    state.base.length > 0 &&
    typeof state.head === "string" &&
    state.head.length > 0 &&
    state.base !== state.head &&
    state.commitBelongsToTicket
  );
}

function reconcileState(input) {
  const state = {
    ledgerStatus: "absent",
    ledgerPhase: "absent",
    commitBelongsToTicket: false,
    ...input,
  };
  const validation = validateRecoveryState(state);
  if (validation) return validation;
  const {
    ticketStatus,
    ledgerStatus,
    ledgerPhase,
    commitPresent,
    base,
    head,
  } = state;
  if (
    ticketStatus === "complete" &&
    ledgerStatus === "complete" &&
    ledgerPhase === "complete" &&
    hasBoundCommit(state)
  ) {
    return {
      action: "no-dispatch",
      reason: "ticket completion and bound commit evidence agree",
      base,
      head,
    };
  }
  if (ticketStatus === "complete" || ledgerStatus === "complete") {
    return {
      action: "BLOCKED",
      reason: "ticket, ledger, and git completion evidence conflict",
    };
  }
  if (ticketStatus === "blocked" || ledgerStatus === "blocked") {
    return { action: "BLOCKED", reason: "persisted blocker requires resolution" };
  }
  if (
    ticketStatus === "in-progress" &&
    ledgerStatus === "in-progress" &&
    commitPresent &&
    ["review-pending", "reviewing"].includes(ledgerPhase) &&
    hasBoundCommit(state)
  ) {
    return {
      action: "resume-review",
      reason: "authorized ticket commit is persisted and awaits review",
      base,
      head,
    };
  }
  if (commitPresent) {
    return {
      action: "BLOCKED",
      reason: "commit identity or persisted review phase is inconsistent",
    };
  }
  if (ticketStatus === "in-progress" && ledgerStatus === "in-progress") {
    return {
      action: "resume-implementation",
      reason: "matching persisted implementation state",
    };
  }
  if (
    ticketStatus === "ready-for-agent" &&
    ["absent", "ready-for-agent"].includes(ledgerStatus) &&
    ledgerPhase === "absent"
  ) {
    return { action: "dispatch", reason: "unstarted frontier ticket" };
  }
  return {
    action: "BLOCKED",
    reason: "ticket and ledger progress states conflict",
  };
}

function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) {
    console.error("Usage: reconcile-state.js <state.json>");
    return 2;
  }
  const state = JSON.parse(fs.readFileSync(argv[0], "utf8"));
  console.log(JSON.stringify(reconcileState(state), null, 2));
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { main, reconcileState };
