---
name: spec-gate
description: Create and self-review a formal Spec for explicit or costly-to-reverse work; wait for approval.
---

# Spec Gate

Create an implementation-ready design artifact from resolved decisions and verified repository facts. This is a zero interview gate: it does not own clarification, user decision loops, or workflow continuation.

## Hard Gate

Do not invoke implementation skills, write implementation code, or generate tickets until the saved Spec has passed self-review and the user has explicitly approved it.

Do not ask clarifying questions. If a user-owned decision can materially change the result, return `BLOCKED_BY_UNRESOLVED_DECISION` before drafting the document.

## Inputs

Consume only:

- the task goal and risk classification;
- confirmed grilling handoff decisions and delegated defaults, when present;
- repository facts verified from current files, history, tests, or tools;
- an optional output path under `docs/superpowers/specs/`.

Treat a confirmed handoff as approved input. Reopen a decision only when its recorded reversal evidence appears or an underlying premise is invalidated.

## Preflight

1. Confirm that a formal Spec is explicitly requested or that the task crosses a high-risk boundary.
2. Inspect discoverable facts instead of turning them into questions.
3. Build a decision inventory from the task, handoff, and repository evidence.
4. Identify the suitable stable seams under `rules/common/testing.md` where acceptance behavior will be tested. Prefer existing
   seams; a new seam that changes a public contract or architecture is a consequential decision.
5. Separate agent-owned reversible details from user-owned consequential decisions.
6. Return an outcome immediately if the task is not applicable or a consequential decision remains unresolved.

Agent-owned details may use the safest reversible default. A user-owned decision may use an agent default only when the confirmed handoff explicitly delegates it.

## Blocking Contract

Use a stable `decision_id` derived from the decision subject, not from the current wording. Return exactly:

```text
BLOCKED_BY_UNRESOLVED_DECISION
- decision_id
- blocking_reason
- known_constraints
- evidence
```

This ends only the current Spec drafting call. Return the outcome to `skills/using-superpowers/SKILL.md`
for continuation within the authorized task. Do not ask a question, generate options, choose for the user,
add `resume_target`, or invoke grilling here.

If the same `decision_id` already has a confirmed resolution and evidence has not changed, report a `Spec Gate contract conflict` and stop. Reopen it only when reversal evidence appears or a foundational premise becomes invalid.

## Document Location

Save to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` unless the user provides another ignored local workflow path. Create the parent directory when necessary.

**Local-only artifact policy:** Treat every generated design Spec as a local workflow artifact. Do not stage or commit it. The default `docs/superpowers/` path is ignored and is not a team-sharing mechanism.

## Spec Schema

Judge completeness by decisions and acceptance, not section count or order. Merge related topics and omit
inapplicable sections; do not create placeholders to fill a template. Cover what affects implementation:

- goal, scope, non-goals, current evidence and consequential decisions;
- chosen approach and meaningful alternatives, interfaces and compatibility;
- relevant architecture, data flow, failure behavior and migration;
- test strategy at suitable seams and repeatable acceptance criteria;
- risks, rollback and any non-blocking open questions.

High-risk designs must make authorization, compatibility, migration safety and recovery clear where relevant.
No blocking decision may be hidden by omitting a section.

Do not include implementation snippets that will become stale. Do not present an unresolved branch as a settled decision.

## Self-Review

Before returning a review outcome:

1. Scan for `TODO`, `TBD`, placeholders, incomplete sections, and contradictions.
2. Verify every consequential choice is resolved or explicitly delegated.
3. Verify architecture, interfaces, failure behavior, migration, tests, acceptance, risk, and rollback agree.
4. Verify each acceptance criterion maps to a repeatable automated or manual check.
5. Verify the scope can produce either one coherent delivery scope or, when needed, a ticket breakdown.
6. For complex or high-risk specs, read `references/spec-document-reviewer-prompt.md` and apply its calibrated review.

Fix non-decision defects inline and repeat the self-review. A newly exposed consequential decision returns the blocking contract instead of entering user review.

## User Review Gate

After self-review, show the saved path and a compact summary of decisions and non-blocking risks. Request artifact approval, not another requirements interview.

- If the user requests document changes, revise the Spec and self-review again.
- If revision exposes a consequential decision, return `BLOCKED_BY_UNRESOLVED_DECISION`.
- If the user approves, mark the artifact as the approved Spec source.

### Tracker publication

Read `docs/agent-workflow/project-context.md` when it exists:

- For a configured local tracker, copy the approved Spec to its configured feature `spec.md` path,
  preserving the local-only policy.
- For an external tracker, show the exact repository/project, title, body source and labels; publish
  only after explicit confirmation of that external write. Apply the configured `ready-for-agent`
  label when the tracker contract defines it.
- If no tracker is configured, keep the approved local artifact and report `tracker: not configured`.

Record the local path and optional tracker reference together so `to-tickets` can consume one canonical
approved source. Publication does not authorize tickets, implementation, commit or PR creation.

After approval/publication, return control to `skills/using-superpowers/SKILL.md`; do not invoke
planning directly.

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

`READY_FOR_USER_REVIEW` does not mean approved. `NOT_APPLICABLE` returns routing responsibility without recommending another Skill.

## Examples

- A clear breaking public API migration goes directly to Spec drafting and user review.
- An API migration with an unresolved compatibility policy returns the blocking contract before writing the document.
- A typo, copy update, or reversible configuration edit returns `NOT_APPLICABLE`.
