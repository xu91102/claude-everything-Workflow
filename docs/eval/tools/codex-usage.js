"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const fields = ["input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens"];
const empty = () => Object.fromEntries(fields.map((key) => [key, 0]));
const add = (a, b) => Object.fromEntries(fields.map((key) => [key, a[key] + b[key]]));
const same = (a, b, keys = fields) => keys.every((key) => a[key] === b[key]);

function usage(value) {
  const result = Object.fromEntries(fields.map((key) => [key, key === "reasoning_output_tokens" ? value?.[key] ?? 0 : value?.[key]]));
  if (fields.some((key) => !Number.isSafeInteger(result[key]) || result[key] < 0)
      || result.cached_input_tokens > result.input_tokens || result.reasoning_output_tokens > result.output_tokens) {
    throw new Error("Invalid Codex response usage counters");
  }
  return result;
}

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(file) : entry.isFile() && file.endsWith(".jsonl") ? [file] : [];
  });
}

// CLI turn totals can exclude native review children. Session records identify each provider response.
function collectCodexUsage(sessionDir, rootId, rawCliUsage, { allowIncompleteCli = false } = {}) {
  if (!rootId) throw new Error("Missing Codex root thread identity");
  const sessions = filesIn(sessionDir).map((file) => {
    let header;
    try { header = JSON.parse(fs.readFileSync(file, "utf8").split("\n", 1)[0]); }
    catch { throw new Error("Unreadable Codex session identity: " + path.relative(sessionDir, file)); }
    if (header.type !== "session_meta" || !header.payload?.id) throw new Error("Invalid Codex session identity");
    const meta = header.payload;
    return { file, id: meta.id, parent: meta.source?.subagent?.thread_spawn?.parent_thread_id || meta.forked_from_id || null };
  });
  if (!sessions.some((session) => session.id === rootId)) throw new Error("Codex root session not found");
  const family = new Set([rootId]);
  let previousSize;
  do {
    previousSize = family.size;
    for (const session of sessions) if (family.has(session.parent)) family.add(session.id);
  } while (family.size !== previousSize);

  const responses = new Map();
  const sessionTotals = new Map();
  const evidence = sessions.filter((session) => family.has(session.id)).map((session) => {
    const bytes = fs.readFileSync(session.file);
    let ownedResponseSeen = false;
    for (const line of bytes.toString("utf8").trim().split("\n")) {
      const event = JSON.parse(line);
      if (ownedResponseSeen && event.type === "event_msg" && event.payload?.type === "token_count"
          && event.payload.info?.total_token_usage) sessionTotals.set(session.id, usage(event.payload.info.total_token_usage));
      if (event.type !== "token_usage_record") continue;
      const record = event.payload;
      if (!record?.response_id || !family.has(record.thread_id)) throw new Error("Invalid Codex response identity");
      const counters = usage(record.usage);
      if (record.thread_id === session.id) ownedResponseSeen = true;
      const old = responses.get(record.response_id);
      if (old && (old.thread_id !== record.thread_id || !same(old.usage, counters))) throw new Error("Conflicting Codex response ID");
      if (!old) responses.set(record.response_id, { thread_id: record.thread_id, usage: counters });
    }
    return { thread_id: session.id, parent_thread_id: session.parent,
      file: path.relative(sessionDir, session.file), sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
  });
  if (!responses.size) throw new Error("Missing Codex provider response usage evidence");
  const records = [...responses.values()];
  for (const id of family) {
    const owned = records.filter((record) => record.thread_id === id);
    if (!owned.length) throw new Error("Missing Codex session response usage: " + id);
    const cumulative = sessionTotals.get(id);
    if (cumulative && !same(cumulative, owned.reduce((sum, record) => add(sum, record.usage), empty()))) {
      throw new Error("Codex session total disagrees with response records: " + id);
    }
  }
  const total = records.reduce((sum, record) => add(sum, record.usage), empty());
  const parent = records.filter((record) => record.thread_id === rootId).reduce((sum, record) => add(sum, record.usage), empty());
  const raw = usage(rawCliUsage);
  const matchesFamily = same(raw, total, fields.slice(0, 3));
  const matchesParent = same(raw, parent, fields.slice(0, 3));
  if (!matchesFamily && !matchesParent && !allowIncompleteCli) throw new Error("Codex CLI usage disagrees with session evidence");
  return { usage: total, root_thread_id: rootId, requests: responses.size, descendant_sessions: family.size - 1,
    raw_cli_scope: matchesFamily ? "whole_session_family" : matchesParent ? "parent_thread_only" : "incomplete_failed_run",
    parent_usage: parent, child_usage: Object.fromEntries(fields.map((key) => [key, total[key] - parent[key]])),
    sessions: evidence, method: "Sum unique provider response_id usage for the root and native descendants only; copied fork history deduplicated, unrelated HOME sessions excluded. Cached input is inside input, reasoning inside output." };
}

module.exports = { collectCodexUsage };
