#!/usr/bin/env node
"use strict";

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const TICKET_ID = "(?:[A-Z]+\\d+|\\d+)";
const VALID_STATUSES = new Set([
  "ready-for-agent",
  "in-progress",
  "blocked",
  "complete",
]);
const TRANSITIONS = {
  "ready-for-agent": new Set(["in-progress", "blocked"]),
  "in-progress": new Set(["ready-for-agent", "blocked", "complete"]),
  blocked: new Set(["ready-for-agent", "in-progress"]),
  complete: new Set(),
};

function headingPattern(flags = "gm") {
  return new RegExp(`^##\\s+(${TICKET_ID})\\s+—\\s+(.+)$`, flags);
}

function parseBlockerRef(value, label, ticketId) {
  const reference = value.trim();
  const direct = reference.match(new RegExp(`^(${TICKET_ID})$`));
  const combined = reference.match(new RegExp(`#(${TICKET_ID})$`));
  const perTicket = reference.match(
    new RegExp(`[/\\\\](${TICKET_ID})(?:-[^/\\\\]+)?\\.md$`),
  );
  const match = direct || combined || perTicket;
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

function parseTickets(source, label = "tickets") {
  const headings = [...source.matchAll(headingPattern())];
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
    const acceptance = [...body.matchAll(/^- \[ \] (.+)$/gm)].map((match) =>
      match[1].trim(),
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

function validateGraph(tickets) {
  const byId = new Map();
  for (const ticket of tickets) {
    if (byId.has(ticket.id)) throw new Error(`duplicate ticket ${ticket.id}`);
    if (!VALID_STATUSES.has(ticket.status)) {
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

function frontier(tickets) {
  validateGraph(tickets);
  const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  return tickets
    .filter(
      (ticket) =>
        ticket.status === "ready-for-agent" &&
        ticket.blockers.every(
          (blocker) => byId.get(blocker).status === "complete",
        ),
    )
    .map((ticket) => ticket.id);
}

function setTicketStatus(source, ticketId, nextStatus, graphTickets) {
  if (!VALID_STATUSES.has(nextStatus)) {
    throw new Error(`invalid ticket status: ${nextStatus}`);
  }

  const tickets = graphTickets ?? parseTickets(source, "ticket-state");
  validateGraph(tickets);
  const ticket = tickets.find((candidate) => candidate.id === ticketId);
  if (!ticket) throw new Error(`ticket not found: ${ticketId}`);
  if (ticket.status === nextStatus) return source;
  if (!TRANSITIONS[ticket.status].has(nextStatus)) {
    throw new Error(
      `invalid ticket status transition: ${ticket.status} -> ${nextStatus}`,
    );
  }
  if (nextStatus === "in-progress") {
    const byId = new Map(tickets.map((candidate) => [candidate.id, candidate]));
    const incomplete = ticket.blockers.filter(
      (blocker) => byId.get(blocker).status !== "complete",
    );
    if (incomplete.length > 0) {
      throw new Error(
        `${ticketId} is not in the persisted frontier; incomplete blockers: ${incomplete.join(", ")}`,
      );
    }
  }

  const headings = [...source.matchAll(headingPattern())];
  const index = headings.findIndex((heading) => heading[1] === ticketId);
  const start = headings[index].index;
  const end = headings[index + 1]?.index ?? source.length;
  const body = source.slice(start, end);
  const status = /^\*\*Status:\*\*\s*(.+)$/m.exec(body);
  if (!status) throw new Error(`${ticketId}: missing Status`);
  const statusStart = start + status.index;
  const statusEnd = statusStart + status[0].length;
  return `${source.slice(0, statusStart)}**Status:** ${nextStatus}${source.slice(statusEnd)}`;
}

function loadTickets(files) {
  return files.flatMap((file) =>
    parseTickets(fs.readFileSync(file, "utf8"), path.basename(file)),
  );
}

function writeFileAtomic(file, content, beforeRename) {
  const directory = path.dirname(file);
  const temporary = path.join(
    directory,
    `.${path.basename(file)}.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`,
  );
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    if (beforeRename) beforeRename(temporary);
    fs.renameSync(temporary, file);
    if (process.platform !== "win32") {
      const directoryDescriptor = fs.openSync(directory, "r");
      try {
        fs.fsyncSync(directoryDescriptor);
      } finally {
        fs.closeSync(directoryDescriptor);
      }
    }
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function withFileLock(file, action) {
  const lock = `${file}.ticket-state.lock`;
  const owner = {
    pid: process.pid,
    created_at: new Date().toISOString(),
    token: crypto.randomBytes(16).toString("hex"),
  };
  let descriptor;
  let acquired = false;
  const processIsAlive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return error?.code === "EPERM";
    }
  };
  const acquire = (allowStaleRecovery) => {
    try {
      descriptor = fs.openSync(lock, "wx", 0o600);
      acquired = true;
      fs.writeFileSync(descriptor, `${JSON.stringify(owner)}\n`, "utf8");
      fs.fsyncSync(descriptor);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let existing;
      let raw;
      try {
        raw = fs.readFileSync(lock, "utf8");
        existing = JSON.parse(raw);
      } catch {
        throw new Error(`ticket state has an unreadable lock: ${lock}`);
      }
      if (
        !allowStaleRecovery ||
        !Number.isSafeInteger(existing.pid) ||
        typeof existing.created_at !== "string" ||
        typeof existing.token !== "string" ||
        processIsAlive(existing.pid)
      ) {
        throw new Error(`ticket state is locked by another writer: ${lock}`);
      }
      if (fs.readFileSync(lock, "utf8") !== raw) {
        throw new Error(`ticket state lock changed during recovery: ${lock}`);
      }
      fs.rmSync(lock);
      acquire(false);
    }
  };
  try {
    acquire(true);
    return action();
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (acquired) {
      try {
        const current = JSON.parse(fs.readFileSync(lock, "utf8"));
        if (current.token === owner.token) fs.rmSync(lock);
      } catch {
        // A missing or replaced lock is not owned by this process.
      }
    }
  }
}

function normalizeRemoteTickets(payload) {
  if (
    !payload ||
    !Array.isArray(payload.tickets) ||
    !payload.status_map ||
    typeof payload.status_map !== "object" ||
    Array.isArray(payload.status_map)
  ) {
    throw new Error("invalid remote tracker payload");
  }
  for (const mappedStatus of Object.values(payload.status_map)) {
    if (!VALID_STATUSES.has(mappedStatus)) {
      throw new Error(`invalid remote status mapping: ${mappedStatus}`);
    }
  }

  const tickets = payload.tickets.map((remote) => {
    if (!remote || typeof remote !== "object" || Array.isArray(remote)) {
      throw new Error("remote ticket: invalid normalized fields");
    }
    const status = payload.status_map[remote.remote_status];
    if (!status) {
      throw new Error(
        `${remote.id ?? "remote ticket"}: unmapped remote status ${remote.remote_status}`,
      );
    }
    const nonEmptyString = (value) =>
      typeof value === "string" && value.trim().length > 0;
    if (
      !nonEmptyString(remote.id) ||
      !nonEmptyString(remote.title) ||
      !nonEmptyString(remote.source) ||
      !nonEmptyString(remote.outcome) ||
      !nonEmptyString(remote.remote_status) ||
      !Array.isArray(remote.blockers) ||
      remote.blockers.some(
        (blocker) =>
          !nonEmptyString(blocker) ||
          !new RegExp(`^${TICKET_ID}$`).test(blocker),
      ) ||
      !Array.isArray(remote.acceptance) ||
      remote.acceptance.length === 0 ||
      remote.acceptance.some((item) => !nonEmptyString(item))
    ) {
      throw new Error(`${remote.id ?? "remote ticket"}: invalid normalized fields`);
    }
    const ticket = {
      id: remote.id.trim(),
      title: remote.title.trim(),
      source: remote.source.trim(),
      outcome: remote.outcome.trim(),
      blockers: remote.blockers.map((blocker) => blocker.trim()),
      status,
      acceptance: remote.acceptance.map((item) => item.trim()),
    };
    if (
      !new RegExp(`^${TICKET_ID}$`).test(ticket.id) ||
      !VALID_STATUSES.has(ticket.status)
    ) {
      throw new Error(`${ticket.id ?? "remote ticket"}: invalid normalized fields`);
    }
    validateTicketContent(ticket, "remote");
    return ticket;
  });
  validateGraph(tickets);
  return tickets;
}

function usage() {
  console.error(
    "Usage:\n" +
      "  node ticket-state.js validate <ticket-file>...\n" +
      "  node ticket-state.js frontier <ticket-file>...\n" +
      "  node ticket-state.js set <ticket-file> <ticket-id> <status> [graph-file...]\n" +
      "  node ticket-state.js normalize-remote <payload.json>",
  );
}

function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  if (command === "validate" && args.length > 0) {
    const tickets = loadTickets(args);
    validateGraph(tickets);
    console.log(`Validated ${tickets.length} tickets.`);
    return 0;
  }
  if (command === "frontier" && args.length > 0) {
    console.log(JSON.stringify(frontier(loadTickets(args))));
    return 0;
  }
  if (command === "normalize-remote" && args.length === 1) {
    const payload = JSON.parse(fs.readFileSync(args[0], "utf8"));
    console.log(JSON.stringify(normalizeRemoteTickets(payload), null, 2));
    return 0;
  }
  if (command === "set" && args.length >= 3) {
    const [file, ticketId, status, ...graphFiles] = args;
    withFileLock(file, () => {
      const source = fs.readFileSync(file, "utf8");
      const files = [...new Set([file, ...graphFiles])];
      const tickets = loadTickets(files);
      writeFileAtomic(
        file,
        setTicketStatus(source, ticketId, status, tickets),
      );
    });
    console.log(`${ticketId}: ${status}`);
    return 0;
  }

  usage();
  return 2;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  VALID_STATUSES,
  frontier,
  main,
  normalizeRemoteTickets,
  parseTickets,
  setTicketStatus,
  validateGraph,
  withFileLock,
  writeFileAtomic,
};
