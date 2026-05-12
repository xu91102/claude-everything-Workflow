---
name: systematic-debugging
description: Use when encountering any bug, failing test, flaky behavior, or unexpected result before proposing fixes. Keeps debugging lightweight but root-cause driven.
---

# Systematic Debugging

Use this skill when implementation or verification reveals a bug, failing test, flaky behavior, or unexpected result.

The goal is not to make debugging heavy. The goal is to stop guessing. Complete the four phases in order, then return to the active task or plan.

<HARD-GATE>
Do not propose or apply a fix until Phase 1 identifies a credible root cause and Phase 3 has tested the hypothesis with the smallest useful check.
</HARD-GATE>

## Phase 1: Root Cause Investigation

- Reproduce the failure with the smallest command or scenario.
- Capture the exact error, failing assertion, log line, or unexpected output.
- Trace backward from the symptom to the first incorrect state.
- Identify what changed recently and which boundary it crosses.

Output: one sentence naming the likely root cause and the evidence for it.

## Phase 2: Pattern Analysis

- Check whether the same pattern appears elsewhere in the codebase.
- Compare against nearby working implementations.
- Decide whether this is a local bug, contract mismatch, missing test, environment issue, or design gap.

Output: the smallest affected scope and any similar files that should or should not change.

## Phase 3: Hypothesis Test

- Form one falsifiable hypothesis.
- Run or add the smallest diagnostic check that can prove or disprove it.
- If the hypothesis fails, return to Phase 1 with the new evidence.
- After two failed fix hypotheses, stop and reassess the design before trying another fix.

Output: confirmed hypothesis or reason for returning to investigation.

## Phase 4: Fix And Verify

- Add or update the failing test first when the project has a suitable test path.
- Apply one focused fix at the source of the root cause.
- Run the failing test or reproduction command.
- Run the task's required verification from the plan.
- Remove diagnostic logging or temporary probes.

Output: root cause, fix summary, commands run, result, and remaining risk.

## Return To Plan

After the fix is verified, return to the original task:

- Re-run the task's normal test command.
- Re-run requirement/spec compliance review.
- Re-run code quality review.
- Only then mark the task complete.
