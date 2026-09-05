# Process Outcomes

Read only for a grilling/Spec outcome or a cross-session handoff. Routing belongs to
`skills/using-superpowers/SKILL.md`; this reference owns the outcome handling details.

## Grilling handoff

Read `Risk classification` and `Resume target`. A non-formal task returns to direct or another narrow
process. A high-risk/formal task with `resume_target: spec-gate` enters a fresh Spec Gate call.

## Spec Gate ready

`READY_FOR_USER_REVIEW` means the local artifact passed self-review but is not approved. Present the
path and wait for explicit approval. Approval returns to the router, which selects a delivery topology
from the approved scope without waiting for the user to name the next Skill.

## Spec Gate blocked

`BLOCKED_BY_UNRESOLVED_DECISION` is terminal for the current call chain:

1. Stop without drafting, guessing, or invoking another Skill.
2. Present a decision map: confirmed decisions, unresolved decision, and blocking point.
3. Let the user choose to continue clarification, reduce scope, or exit the formal flow.
4. Only an explicit choice to continue starts a new grilling session.
5. After that session completes, route again into a new Spec Gate; do not resume the old call stack.

If the same confirmed `decision_id` blocks again with unchanged evidence, report a `Spec Gate contract conflict`.
Do not repeat the question. Only reversal evidence or an invalidated premise can reopen it.

## Spec Gate not applicable

`NOT_APPLICABLE` returns to the router. Select the shortest applicable path without asking the
originating Skill to recommend a successor.

## Cross-session handoff

When a prototype detour needs isolation or the current context is leaving its reliable reasoning zone,
recommend the `handoff` Skill and wait for explicit approval before creating the temporary document.
The handoff ends the current flow; a fresh session references the returned path and enters the router.
Do not substitute handoff for durable Specs, ADRs, tickets, or verification evidence.
