---
name: systematic-debugging
description: Use when encountering any bug, failing test, flaky behavior, or unexpected result before proposing fixes. Keeps debugging lightweight but root-cause driven.
---

# Systematic Debugging

Use this skill when implementation or verification reveals a bug, failing test, flaky behavior,
performance regression, or unexpected result.

Origin includes `mattpocock/skills@2ab9580` diagnosing-bugs. The goal is to stop guessing by making
the bug mechanically observable before forming a theory.

<HARD-GATE>
Do not form, propose, or apply a root-cause hypothesis until the Feedback Loop Gate has passed.
Do not apply a fix until a ranked hypothesis has been falsifiably tested.
</HARD-GATE>

## Feedback Loop Gate

Phase 1 must produce one command that has already run and can catch the user's exact symptom:

- **Red-capable**: exercises the real bug path and fails on the reported behavior, not a nearby error.
- **Deterministic**: gives the same verdict; for flaky bugs record a pinned higher reproduction rate.
- **Fast**: normally seconds, after narrowing setup and unrelated work.
- **Agent-runnable**: unattended, or driven by a structured human-in-the-loop script.

Prefer, in order: a focused test, HTTP/CLI invocation, headless-browser assertion, captured-trace replay,
throwaway harness, property/fuzz loop, bisection harness, or differential old/new run. Tighten signal,
speed, and determinism before proceeding.

For flaky bugs, loop, stress, seed, isolate timing, and raise the reproduction rate. For performance
regressions, establish a repeatable timing/profiler/query-plan baseline before reading for a theory.

If no red-capable loop is possible, stop and report attempts plus the exact missing environment,
captured artifact, or instrumentation approval. No loop means no hypothesis.

## Phase 1: Root Cause Investigation

- Run the gated command and confirm the user's exact symptom.
- Minimize inputs, callers, configuration, data, and steps one at a time until the smallest scenario
  remains; every remaining element must be load-bearing.
- Capture the exact error, failing assertion, log line, or unexpected output.
- Trace backward from the symptom to the first incorrect state.
- Identify what changed recently and which boundary it crosses.

Output: command, captured red result, reproduction rate, minimized scenario, and relevant boundary.

## Phase 2: Pattern Analysis

- Check whether the same pattern appears elsewhere in the codebase.
- Compare against nearby working implementations.
- Decide whether this is a local bug, contract mismatch, missing test, environment issue, or design gap.

Output: the smallest affected scope and any similar files that should or should not change.

## Phase 3: Hypothesis Test

- Form 3–5 ranked hypotheses before testing any one. Each must predict what observable change would
  falsify it.
- Test one variable at a time with the smallest diagnostic probe.
- If a hypothesis fails, update the ranking from evidence; do not patch speculatively.
- After repeated failed hypotheses, reassess the loop and design instead of stacking fixes.

Output: confirmed hypothesis or reason for returning to investigation.

## Phase 4: Fix And Verify

- Convert the minimized repro into a failing regression test at the same public seam before the fix.
- Apply one focused fix at the source of the root cause.
- Run the regression test and the original Feedback Loop Gate command.
- Run the task's required verification from the plan.
- Remove tagged diagnostic logging and temporary probes.

Output: root cause, fix summary, commands run, result, and remaining risk.

If no correct regression seam exists, document that architectural finding rather than adding a
misleading shallow test. After the fix, route the seam/coupling evidence through
`skills/improve-codebase-architecture/SKILL.md`.

## Return To Plan

After the fix is verified, return to the original task:

- Re-run the task's normal test command.
- Re-run requirement/spec compliance review.
- Re-run code quality review.
- Only then mark the task complete.
