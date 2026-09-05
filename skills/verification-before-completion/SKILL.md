---
name: verification-before-completion
description: Before claiming done, fixed, passing, or ready, run fresh checks and report skipped items and risks.
---

# Verification Before Completion

Use this skill before any success or completion claim.

Core rule: do not say work is complete, fixed, passing, or ready unless fresh verification evidence from this turn supports that claim.

## Gate

Before making a completion claim:

1. Identify the smallest command or manual check that proves the claim.
2. Run the full relevant command now, unless the environment makes it impossible.
3. Read the output and exit code.
4. Compare the result against the exact claim.
5. Report the claim only with evidence.

If verification cannot run, say that it was not run and explain the remaining risk. Do not replace evidence with confidence.

## Claims And Required Evidence

| Claim | Required evidence |
| --- | --- |
| Tests pass | Fresh test command output with exit code 0 or an exact pass count |
| Build succeeds | Fresh build command output with exit code 0 |
| Lint is clean | Fresh lint command output with zero reported errors |
| Bug is fixed | Fresh reproduction or regression test showing the original symptom no longer occurs |
| Task is complete | Spec, plan, or user request checklist verified against the changed files |
| Ready for `/pr` | `/verify` or equivalent checks with skipped checks and risks stated |
| Agent work is done | Independent inspection of the diff and required verification, not only the agent report |

## Red Flags

Stop and verify before using language like:

- "完成了"
- "已修复"
- "通过了"
- "可以提交"
- "ready"
- "should pass"
- "looks good"
- "应该没问题"

## Failed Or Partial Verification

If verification fails:

1. State the exact failing command and result.
2. Use `skills/systematic-debugging/SKILL.md` before changing code.
3. Re-run the relevant verification after the fix.

If verification is partial:

1. State what passed.
2. State what did not run and why.
3. State what risk remains.
4. Avoid broader completion claims than the evidence supports.

## Reporting Format

Use this compact format in final summaries and task checkpoints:

```text
验证：
- <command>: <passed/failed/not run> — <evidence>

未运行：
- <check>: <reason>

剩余风险：
- <risk or "无已知剩余风险">
```
