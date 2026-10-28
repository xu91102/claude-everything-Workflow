---
name: spec-gate
description: Create and self-review a formal Spec for explicit or costly-to-reverse work; wait for approval.
---

# Spec Gate

Create an implementation-ready design from resolved decisions and verified facts. This is a zero interview
gate: clarification and workflow continuation belong to `skills/using-superpowers/SKILL.md`.

## Hard Gate

Do not invoke implementation skills, write implementation code, or generate tickets until the saved Spec
has passed self-review and the user has explicitly approved it.

Use this gate for an explicitly requested formal Spec or a high-risk boundary. A typo, copy update or
reversible configuration edit returns `NOT_APPLICABLE` to the router without recommending another Skill.

## Facts and Decisions

- Consume the goal and risk, confirmed handoff decisions and delegated defaults, verified repository
  facts, and an optional local workflow output path. Inspect discoverable facts instead of asking the user.
- Batch independent reads and reuse verified inputs. Read rules relevant to the design and use read-only
  checks to establish current behavior. Identify existing public seams for repeatable acceptance.
- Use the safest reversible default for agent-owned details. A consequential user-owned choice requires
  a confirmed resolution or explicit delegation; a new public seam or changed contract can be such a choice.
- A confirmed handoff is approved input. Reopen a decision only when its recorded reversal evidence or
  an invalidated premise warrants it. An already resolved `decision_id` without changed evidence is a
  `Spec Gate contract conflict`: stop rather than reopening it.
- If a consequential decision remains unresolved, return `BLOCKED_BY_UNRESOLVED_DECISION` before drafting.
  Derive a stable `decision_id` from the subject. Do not ask questions, choose for the user, generate
  options, add `resume_target`, or invoke grilling; return the outcome to the router.

## Saved Spec

Save to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, creating parents, unless the user supplies
another ignored local workflow path. **Local-only artifact policy:** the Spec is a local workflow artifact.
Do not stage or commit it. The ignored default path is not a team-sharing mechanism.

For a bounded change, save a compact decision record covering verified facts and scope; resolved behavior,
constraints and interfaces; repeatable acceptance checks; relevant risks and recovery. Combine related
choices, cover every material decision, and avoid repeating facts or including stale implementation code.
Public-contract changes cover compatibility and consumer impact; authorization covers trust, permissions
and denial behavior; persistent data covers migration order, partial failure, recovery and rollback limits.
An unresolved choice must not appear settled. Read [references/spec-template.md](references/spec-template.md)
when interacting public seams or decisions need a fuller structure.

## Self-Review

Apply every relevant check to the saved content, including for complex or high-risk Specs:

1. No `TODO`, `TBD`, placeholders, incomplete sections or contradictions.
2. Every consequential choice resolved or explicitly delegated.
3. Agreement among scope, architecture, interfaces, failure behavior, compatibility, migration and rollback;
   normal, adversarial, retry and partial-state paths covered where relevant.
4. Each acceptance criterion mapped to a repeatable automated seam or explicit manual check.
5. One coherent implementation ticket or ticket breakdown can deliver the scope, with no unrequested
   subsystem or speculative extension.

For interacting decisions or an uncertain readiness check, apply
[references/spec-document-reviewer-prompt.md](references/spec-document-reviewer-prompt.md).
Block on defects that can produce a wrong implementation or unsafe plan; wording and style are advisory.
Fix non-decision defects and repeat self-review; a newly exposed consequential choice returns the blocking
outcome. Reuse the verified write content after a successful save; reread if truncated, changed or not
saved successfully. Avoid separate repeated scans or implementation verification before approval.

## User Review and Publication

Return the saved path, compact decisions and non-blocking risks with the approval request. Request
artifact approval, not another interview. Requested revisions require self-review again; unresolved
consequential choices return the blocking outcome. User approval marks the artifact as the approved source.

After approval, read `docs/agent-workflow/project-context.md` when it exists:

- Configured local tracker: copy the approved Spec to its feature `spec.md`, retaining the local-only policy.
- External tracker: show the exact repository/project, title, body source and labels; publish only after
  explicit confirmation of that external write. Apply `ready-for-agent` when the tracker contract defines it.
- No configured tracker: keep the approved local artifact and report `tracker: not configured`.

Record the local path and optional tracker reference as one canonical approved source. Publication does
not authorize tickets, implementation, commit or PR creation. Return to `skills/using-superpowers/SKILL.md`
after approval/publication; do not invoke planning directly.

## Outcomes

Return exactly one of:

```text
READY_FOR_USER_REVIEW
- spec_path
- self_review_checks
- non_blocking_risks

BLOCKED_BY_UNRESOLVED_DECISION
- decision_id
- blocking_reason
- known_constraints
- evidence

NOT_APPLICABLE
- reason
```

`READY_FOR_USER_REVIEW` does not mean approved. A clear breaking public API migration goes directly to
Spec drafting and user review; unresolved compatibility policy blocks before the document is written.
