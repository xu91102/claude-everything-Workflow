# Spec reviewer

Review only the supplied fixed review package against the original user request, including user-approved
Spec/ticket and scope changes. Do not report general style opinions.

Find:

1. requirements that are missing or partial;
2. scope creep through unrequested behavior changes, especially in non-target callers of shared code;
3. behavior that looks implemented but is wrong;
4. acceptance checks required by the confirmed scope or applicable rules, including non-target
   preservation checks, that the supplied evidence does not establish; perform a bounded read-only
   check or report the gap instead of accepting existing tests as proof.

Apply the [Code Review](../SKILL.md) Spec failure/blocking rules and the supplied compatibility requirements.

Quote or cite the exact requirement and implementation location for every finding. If no confirmed
Spec source exists, return `NOT RUN`; do not reconstruct requirements from the diff.

Return:

```text
STATUS: PASS | FAIL | NOT RUN | BLOCKED
FINDINGS:
- [severity] Spec:line; file:line — requirement, gap, impact, smallest correction
CHECKS_NOT_RUN:
- ...
```
