# Spec Document Reviewer Prompt

Read this reference only after a Spec has been written and the main self-review needs an independent, calibrated pass.

```text
Review the Spec at [SPEC_FILE_PATH] for ticket-decomposition readiness.

Check:
- Completeness: no TODO, TBD, placeholder, missing contract, or incomplete section.
- Decision integrity: no unresolved user-owned choice is disguised as an implementation detail.
- Consistency: requirements, architecture, interfaces, data flow, error handling, migration, and rollback agree.
- Testability: each acceptance criterion has an automated seam or explicit repeatable manual check.
- Scope: one coherent tracer-bullet ticket graph can deliver the result.
- YAGNI: no unrequested subsystem or speculative extension.
- Failure behavior: normal, adversarial, retry, partial-state, and compatibility paths are covered where relevant.

Only block on defects that can produce the wrong implementation or an unsafe ticket graph. Keep wording and style suggestions advisory.

Return:

## Spec Review
Status: Approved | Issues Found | Blocked By Unresolved Decision

Blocking issues:
- [section]: [specific defect] — [ticketing impact]

Advisory recommendations:
- [non-blocking improvement]
```

If review finds a consequential unresolved decision, the main Spec Gate must return `BLOCKED_BY_UNRESOLVED_DECISION`; the reviewer must not answer it.
