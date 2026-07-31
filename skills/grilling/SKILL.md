---
name: grilling
description: "Use for /grill, pressure-testing, or a consequential unresolved user decision. Resolve one decision per turn; do not trigger for discoverable facts, ordinary complexity, file count, or high risk alone."
---

# Grilling

Sharpen a plan, design, or task by resolving consequential user decisions without becoming a universal workflow gate.

Reference: https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md

## Boundary

- Do not ask for discoverable facts. Inspect files, documentation, logs, history, and tools first.
- Ask only about a user-owned decision whose alternatives materially change the result.
- Route systematic evidence or blind-spot gaps back through `skills/using-superpowers/SKILL.md` for `iterative-retrieval`.
- High risk alone does not trigger an interview. If high-risk work has a real unresolved user decision, resolve it and record `resume_target: spec-gate`.
- Do not generate or approve a Spec, implement code, or own workflow continuation.

## Existing Confirmed Handoff

Treat confirmed decisions and delegated defaults from an existing handoff as approved input. Do not re-ask them.

Reopen one decision only when its recorded reversal evidence appears or an underlying premise is invalidated. A merely available alternative or changed agent preference is not new evidence.

## Interview Loop

Track the decision tree, resolved branches, delegated defaults, rejected alternatives, and remaining consequential branches.

Ask one question per turn. Each turn must:

1. Explain why the decision changes the result.
2. Present two or three mutually exclusive options.
3. Give a recommended answer and concise rationale.
4. State the reversal evidence that would change the recommendation.

Mark weak-evidence recommendations as tentative. Wait for the user's answer before opening another branch.

After each answer:

- prune irrelevant branches;
- accept a rejected recommendation without repeated persuasion;
- when the user says “you decide,” adopt the recommended default and mark it delegated;
- record reversal evidence for the accepted choice, not only the original recommendation;
- show the smallest conflict when an answer contradicts a confirmed decision;
- stop immediately and list unresolved decisions when the user ends the session.

## Modes

### Inline uncertainty mode

Use when the central router finds a consequential decision blocking the shortest safe path. Ask only the highest-value unresolved question and stop as soon as the answer is sufficient.

For a low-risk task, return the handoff for direct or narrow-process routing. For high-risk/formal work, preserve its prior classification and use `resume_target: spec-gate`; do not call Spec Gate directly.

### Explicit grilling session

Use when the user explicitly invokes `/grill`, says grill me, or asks to challenge a plan, design, decision, or idea. Walk the consequential decision tree until branches are resolved or delegated, then use the shared-understanding gate.

## Handoff

All cross-Skill results use this structure:

```text
Goal:
Route context:
- Risk classification:
- Resume target:
Resolved decisions:
- Decision: <accepted value>
  Reversal evidence: <evidence or condition that reopens it>
Delegated defaults:
- Default: <accepted default>
  Reversal evidence: <evidence or condition that reopens it>
Rejected alternatives:
Remaining risks:
```

Use `resume_target: spec-gate` only when the router already classified the task as high-risk/formal. Do not invent a high-risk classification during handoff formatting.

For an explicit session, ask whether shared understanding has been reached. Do not act, write files, or enter implementation before confirmation. Inline mode may return without an extra confirmation gate when the blocking decision is resolved.

After exit, return to `skills/using-superpowers/SKILL.md` for routing. A fresh session created after `BLOCKED_BY_UNRESOLVED_DECISION` must not resume the old Spec Gate call stack; it returns a new handoff to the router.
