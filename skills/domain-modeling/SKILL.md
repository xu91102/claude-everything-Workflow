---
name: domain-modeling
description: "Model domain vocabulary, entity relationships, invariants, lifecycle transitions, and bounded context changes. Use only when a task introduces or changes domain concepts or ownership boundaries; do not trigger for ordinary code complexity, file count, or merely consuming existing CONTEXT.md vocabulary."
---

# Domain Modeling

Make domain changes explicit without becoming a workflow gate or a second clarification engine.

## Boundary

Trigger only when the task introduces or changes at least one of:

- domain terms and their precise meanings;
- entities, value objects, or their relationships;
- invariants and ownership rules;
- lifecycle states or transitions;
- a bounded context or the contract between contexts.

Do not trigger for ordinary code complexity, a new module that reuses the existing model, or read-only use of established `CONTEXT.md` vocabulary.

## Inputs

Consume verified repository facts, an optional confirmed grilling handoff, the current approved or
draft Spec, and `docs/agent-workflow/project-context.md` when it exists. Do not ask the user for
discoverable facts and do not own consequential user decisions.

## Workflow

1. Extract existing terms, entities, invariants, states, owners, and context boundaries from code and documents.
2. Identify what the task adds, removes, renames, or transfers.
3. State ambiguous terms and contract conflicts without silently resolving user-owned choices.
4. Produce the smallest model needed for the task: glossary, relationship list, invariants, lifecycle, boundary map, and ADR recommendation when relevant.
5. Return the model to the currently routed Skill; do not select or invoke the next workflow Skill.

## Output

Use only the applicable parts:

```text
Domain vocabulary:
- Term: definition

Entities and relationships:
- Entity/value object: ownership and relationship

Invariants:
- invariant and enforcement boundary

Lifecycle:
- state -> event -> next state

Bounded contexts:
- context: responsibility and external contract

ADR recommendations:
- decision that merits a durable record

Unresolved consequential decisions:
- stable decision subject and evidence
```

If an unresolved item changes product meaning, ownership, a public contract, persistence, or a high-cost boundary, return it to the current router/Spec Gate contract. Do not interview or choose for the user.

## Persistence Gate

Default mode keeps output in the active handoff or Spec. Do not modify tracked `CONTEXT.md`, ADRs,
schemas, or code merely because domain modeling triggered.

**Persistent documentation mode** is enabled only by an explicit documented grilling request or
direct user approval to maintain domain docs during the session. In that mode:

1. Use the confirmed context and ADR locations from `docs/agent-workflow/project-context.md`.
2. When a term becomes stable, show the exact glossary change and obtain write approval before
   updating it inline.
3. Offer an ADR only when the decision is hard to reverse, surprising without context and the result
   of a real trade-off; show its path/content before writing.
4. Keep `CONTEXT.md` implementation-free and keep ADRs concise.

Outside that mode, persistence after an approved Spec remains an explicit implementation-plan task.
If project context is absent, do not invent a documentation layout.

### Glossary shape

- Define only project-specific domain terms in one or two sentences.
- Choose one canonical term and list misleading synonyms under `Avoid`.
- A single-context repository uses root `CONTEXT.md`; a real multi-context repository uses
  `CONTEXT-MAP.md` pointing to context-local glossaries.

### ADR shape

- Use the configured ADR directory and the next sequential number.
- Lead with one short paragraph covering context, decision and reason.
- Add status, alternatives or consequences only when they carry durable information.

## Examples

- Adding a subscription entity with trial, active, suspended, and cancelled lifecycle states triggers this Skill.
- Renaming an internal helper while consuming unchanged billing vocabulary does not trigger it.
- Moving authorization ownership between bounded contexts triggers it and may surface a high-risk decision for Spec Gate.
