---
name: to-tickets
description: "Break an approved Spec, plan, issue, or conversation into tracer-bullet vertical-slice tickets with explicit blocking edges. Use for multi-session or tracker-coordinated delivery after requirements are resolved; require approval before publishing local or external tracker artifacts."
---

# To Tickets

Origin: `mattpocock/skills@2ab9580`, adapted to `docs/agent-workflow/project-context.md` and this
repository's external-write approval boundary.

## Preconditions

- Read the source artifact and comments completely.
- Read configured tracker, domain-doc and triage-label sections from
  `docs/agent-workflow/project-context.md`.
- If configuration is missing, return `NEEDS_PROJECT_CONTEXT`; do not invent an external tracker.
- Do not reopen approved product decisions. Return unresolved consequential decisions to the router.

## Draft Tracer Bullet Vertical Slices

Break work into tracer bullet slices, not layer-by-layer batches.

Each ticket:

- delivers a narrow but complete path across every required layer;
- is independently demoable or verifiable;
- fits one fresh context window;
- states acceptance criteria through public behavior;
- declares every ticket that blocks it.

Use prefactoring first only when it makes later behavior slices possible. A wide mechanical refactor may
use expand–migrate–contract tickets when no individual vertical slice can remain green.

Build a dependency graph and reject:

- cycles;
- blockers that do not truly gate the dependent ticket;
- horizontal “all schema”, “all API”, or “all UI” tickets;
- speculative tickets outside the approved scope.

## Review Gate

Present the numbered draft with title, blocked-by list, delivered behavior and acceptance criteria.
Ask the user to approve granularity and edges. Do not publish before approval.

## Publish

- **Local tracker**: write one file per ticket under the configured feature directory, blockers first.
- **External tracker**: show exact repository/project, titles, labels and relationship mutations; obtain
  explicit confirmation, then create blockers first and use native dependencies when available.

Never modify or close a parent issue unless separately requested.

## Ticket Shape

```markdown
# <NN> — <Title>

**What to build:** <end-to-end behavior>
**Blocked by:** <tickets or None>
**Status:** ready-for-agent

## Acceptance criteria
- [ ] ...

## Out of scope
- ...
```

Return:

```text
TICKETS_PUBLISHED
- source
- tracker
- ticket references
- dependency frontier
- next implementable tickets
```

An approved ticket is an implementation contract. `/implement` may execute one frontier ticket in a
fresh context without regenerating the whole project plan.
