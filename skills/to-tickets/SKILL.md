---
name: to-tickets
description: "Break an approved Spec, issue, or conversation into tracer-bullet vertical-slice tickets with explicit blocking edges. Use when the router selects durable multi-session or tracker-coordinated delivery; require approval before publishing local or external tracker artifacts."
---

# To Tickets

Origin: `mattpocock/skills@2ab9580`, adapted to `docs/agent-workflow/project-context.md` and this
repository's external-write approval boundary.

The router may select this Skill after the user authorizes a defined delivery scope; selecting a ticket
topology does not approve ticket publication or change the approved product scope.

## Gather Context

- Read the source artifact and comments completely. A ticket flow may start from an approved Spec, an
  existing issue, or the current conversation; do not create a second detailed implementation plan.
- Read configured tracker, domain-doc and triage-label sections from
  `docs/agent-workflow/project-context.md`.
- If configuration is missing, return `NEEDS_PROJECT_CONTEXT`; do not invent an external tracker.
- Do not reopen approved product decisions. Return unresolved consequential decisions to the router.

If the codebase has not been explored, inspect only the affected area to learn established domain terms,
existing ADRs and possible prefactoring. Do not turn that exploration into per-file implementation notes.

## Draft Tracer Bullet Vertical Slices

Break work into tracer bullet slices, not layer-by-layer batches.

Each ticket:

- delivers a narrow but complete path across every required layer;
- is independently demoable or verifiable;
- fits one fresh context window;
- states acceptance criteria through public behavior;
- declares every ticket that blocks it.

Ticket bodies must describe the delivered behavior from the user's perspective. Do not include specific
file paths, line numbers, code snippets, or a layer-by-layer implementation list: these details go stale
and a fresh implementer can discover them from the codebase. Exception: keep the smallest decision-rich
snippet from a prototype when prose cannot preserve a verified state machine, reducer, schema or type
shape; label it as prototype evidence.

Use prefactoring first only when it makes later behavior slices possible. A wide mechanical refactor may
use expand–migrate–contract tickets when no individual vertical slice can remain green.

Build a dependency graph and reject:

- cycles;
- blockers that do not truly gate the dependent ticket;
- horizontal “all schema”, “all API”, or “all UI” tickets;
- speculative tickets outside the approved scope.

## Review Gate

Present the numbered draft with title, blocked-by list, delivered behavior and acceptance criteria. Ask
whether the acceptance criteria, granularity and blocking edges are correct, and whether any ticket should
merge or split. Do not publish before approval.

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

- [ ] <publicly verifiable behavior>
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

An approved ticket is an implementation contract. The `implement` Skill may execute one frontier ticket
in one fresh context without regenerating a project plan.
