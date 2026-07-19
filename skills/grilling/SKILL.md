---
name: grilling
description: "Stress-test a plan, design, decision, or idea through a one-question-at-a-time interview. Use when the user invokes /grill, says grill me, asks to be challenged, 拷问, 压力测试, or wants a plan stress-tested; also use when progress is blocked by an unresolved user-owned decision whose alternatives materially change the outcome after high-risk classification is ruled out. Do not use merely because work is complex, high-risk, new, or spans multiple files."
---

# Grilling

Sharpen a plan or design by resolving consequential user decisions without turning every complex task into a longer workflow.

Reference: https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md

## Boundary

- Do not ask for discoverable facts. Inspect the filesystem, documentation, logs, and available tools first.
- Ask only about an unresolved user-owned decision whose alternatives materially change the outcome.
- Route systematic evidence or blind-spot gaps to `skills/discover-unknowns-zh/SKILL.md`.
- Route costly-to-reverse architecture or service boundaries, public-contract compatibility, security boundaries, persistent data/schema migrations, and irreversible external side effects directly to `skills/brainstorming/SKILL.md`; do not insert inline grilling first.
- Do not trigger merely because work is complex, high-risk, new, or spans multiple files.
- Do not make grilling a mandatory predecessor to `skills/brainstorming/SKILL.md`.

## Interview Loop

Track the current decision tree, resolved branches, delegated defaults, rejected alternatives, and remaining consequential branches.

Ask one question per turn. Each turn must:

1. Explain why the decision changes the result.
2. Present two or three mutually exclusive options.
3. Give a recommended answer and a concise rationale.
4. State the reversal evidence or condition that would change the recommendation.

Mark the recommendation as tentative when evidence is weak. Wait for the user's answer before opening another branch.

After each answer:

- prune branches that are no longer relevant;
- accept a rejected recommendation without repeated persuasion;
- when the user says “you decide,” adopt the recommended default and record it as delegated;
- record reversal evidence for the accepted decision, not merely for the recommendation; if the user rejects the recommendation, derive the condition from the chosen option's stated premises, or mark it tentative and name the missing evidence rather than copying an inapplicable condition;
- when an answer conflicts with an earlier decision, show the smallest conflict and ask one trade-off question;
- when the user stops the session, stop immediately and list unresolved decisions without acting.

## Modes

### Inline uncertainty mode

Use only after high-risk classification is ruled out. Use this mode when `using-superpowers` automatically routes a key unknown. Ask only the highest-value unresolved question. As soon as the answer provides enough information for the lowest-risk implementation path, stop interviewing and return to the shortest applicable workflow without an extra confirmation gate or handoff file.

If another consequential unknown still blocks safe action, ask that single next question in the following turn. If the answer reveals a costly-to-reverse architecture boundary, public-contract compatibility risk, security boundary, persistent data migration, or irreversible external side effect, recommend `skills/brainstorming/SKILL.md`.

### Explicit grilling session

Use this mode when the user explicitly invokes `/grill` or asks for a plan, design, decision, or idea to be pressure-tested. Walk the consequential decision tree until its branches are resolved or delegated, then use the shared-understanding exit below.

## Exit

For an explicit grilling session, when every consequential branch is resolved or has an accepted default, show one compact handoff:

Each resolved decision and delegated default must include the accepted value and its own reversal evidence:

```text
Goal:
Resolved decisions:
- Decision: <accepted value>
  Reversal evidence: <new evidence or condition that would reopen it>
Delegated defaults:
- Default: <accepted default>
  Reversal evidence: <new evidence or condition that would reopen it>
Rejected alternatives:
Remaining risks:
```

Ask whether shared understanding has been reached. Do not act, write files, or enter implementation before confirmation.

After confirmation, return to `skills/using-superpowers/SKILL.md` for routing without another handoff gate. If the result is high-risk or the user explicitly opted into a formal design, pass the confirmed handoff to `skills/brainstorming/SKILL.md`; otherwise the router selects the shortest applicable implementation or planning path. Resolved decisions must not be asked again unless their recorded reversal evidence appears or an underlying premise is invalidated.
