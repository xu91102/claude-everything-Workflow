---
name: wayfinder
description: Map explicit multi-session uncertainty into decisions and an unblocked frontier; do not use for scoped work.
disable-model-invocation: true
---

# Wayfinder

Origin: `mattpocock/skills@2ab9580`, adapted to this repository's tracker and approval contracts.

Wayfinder resolves decisions, not deliverables. The destination defines what “the way is clear” means.

## Map Model

The configured tracker stores:

- one canonical **map** with Destination, Notes, Decisions so far, Not yet specified and Out of scope;
- child **decision tickets**, each holding one question;
- explicit blocking edges;
- a **frontier** of open, unblocked and unclaimed tickets.

Ticket types:

- `research` (AFK): primary-source evidence via `skills/research/SKILL.md`;
- `prototype` (HITL): concrete behavior/visual feedback via `skills/prototype/SKILL.md`;
- `grilling` (HITL): consequential decisions via `skills/grilling/SKILL.md`;
- `task`: prerequisite work whose result unlocks a decision.

Refer to maps and tickets by linked title, not bare identifiers.

## Chart a Map

1. Read tracker/domain configuration. If missing, return `NEEDS_PROJECT_CONTEXT`.
2. Use grilling and domain modeling to define the destination and scope.
3. Explore breadth-first for decisions visible now.
4. Put precise questions into tickets; keep vague future areas under Not yet specified.
5. Draft the map, initial tickets and blocking graph.
6. Obtain approval before creating local files or external tracker objects.
7. Create tickets first, then wire edges after stable identifiers exist.
8. Dispatch independent research tickets in parallel only when the runtime allows safe background work.
9. Stop after charting; do not implement the destination.

If no real fog remains and the work fits one session, return `MAP_NOT_NEEDED` and route normally.

## Work the Map

1. Load only the map's low-resolution view.
2. Use the named ticket or first frontier ticket.
3. Claim it before work after confirming the tracker mutation.
4. Resolve one ticket per session; independent research tickets may run in parallel.
5. Record the answer at the ticket, close it, and append a one-line linked gist to Decisions so far.
6. Create newly visible tickets, graduate clarified fog, and close anything now outside the destination.
7. Stop. A later session takes another frontier ticket.

When the frontier and fog are empty, return `WAY_CLEAR` with the map reference. The central router sends
the resolved decisions to `spec-gate`, then `to-tickets`; do not jump directly to implementation unless
the effort proved genuinely small.
