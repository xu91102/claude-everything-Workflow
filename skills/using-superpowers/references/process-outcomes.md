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

`BLOCKED_BY_UNRESOLVED_DECISION` ends the current Spec drafting call and returns to the router:

1. Preserve the confirmed decisions and evidence; do not draft through an unresolved decision.
2. Show a compact decision map and use grilling inline to ask the missing consequential question within
   the user's authorized task; do not ask whether to continue clarification.
3. Wait for the user's answer or explicit delegation. Silence is not a decision or approval.
4. Once resolved, route into a new Spec Gate with the updated handoff; do not resume the old call stack.
   The resulting Spec still needs user approval before implementation.
5. If the user pauses or ends the task, stop. A new scope or external action still requires its own
   authorization; clarification does not expand the original request.

If the same confirmed `decision_id` blocks again with unchanged evidence, report a `Spec Gate contract conflict`.
Do not repeat the question. Only reversal evidence or an invalidated premise can reopen it.

## Spec Gate not applicable

`NOT_APPLICABLE` returns to the router. Select the shortest applicable path without asking the
originating Skill to recommend a successor.

## Cross-session handoff

When a prototype detour needs isolation or the current context is leaving its reliable reasoning zone,
recommend a handoff and wait for the user's request or acceptance before creating the temporary
document. A clear natural-language request is sufficient; do not require command syntax.
The handoff ends the current flow; a fresh session references the returned path and enters the router.
Do not substitute handoff for durable Specs, ADRs, tickets, or verification evidence.
