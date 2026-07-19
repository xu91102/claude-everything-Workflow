---
name: writing-plans
description: Use when an execution-ready task benefits from a persisted multi-step implementation plan because of coordination, handoff, dependencies, or user request. Accepts clear requirements, an approved design, or an approved spec; do not require a spec for its own sake.
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Verification checkpoints.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** If working in an isolated worktree, it should be created via `skills/using-git-worktrees/SKILL.md` at execution time.

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

## Preconditions

Only write an implementation plan when the work is execution-ready: goals, binding constraints, success criteria, and implementation-changing decisions are stable. The Plan Gate input may be clear user requirements, an approved design, or an approved spec.

## No Spec Tax

Do not require an approved spec merely because a task is large or touches multiple files. If one consequential unknown remains, use `skills/grill-me/SKILL.md`. Use `skills/brainstorming/SKILL.md` only for explicit formal design or high-risk decisions. If direct implementation is easier to understand and verify than a persisted plan, do not write a plan.

## Scope Check

If the source requirements cover multiple independent subsystems, split them into separate plans when each can produce working, testable software on its own. Do not force this decomposition when one short plan remains clearer.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Inspect the diff and record status" - step

Do not include commit steps by default. Add `git add` or `git commit` steps only when the user explicitly asks for commit handling, or when an approved workflow already says this plan is allowed to create commits.

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Keep checkbox (`- [ ]`) status updated. For substantial plans, prefer the project-agent loop: one fresh implementation subagent per task, then requirement/spec compliance review, then code quality review.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

## Global Constraints

[The project-wide requirements — version floors, dependency limits,
naming and copy rules, platform requirements, commit/PR boundaries, exact
values — one line each, copied verbatim from the approved design, spec, or user instruction.
Every task's requirements implicitly include this section.]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Interfaces:**
- Consumes: [what this task uses from earlier tasks — exact signatures, file paths, commands, or data contracts]
- Produces: [what later tasks rely on — exact function names, parameter and return types, CLI flags, file formats, or documented behavior. A task implementer may see only this task, so neighboring contracts must be explicit.]

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Inspect the diff**

```bash
git diff -- tests/path/test.py src/path/file.py
git status --short
```
````

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task
- Missing `Global Constraints` or per-task `Interfaces` blocks

## Remember
- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- DRY, YAGNI, TDD, verification checkpoints
- Copy binding cross-task constraints into `Global Constraints`; do not assume implementers or reviewers will remember the source conversation or spec.
- Every task needs an `Interfaces` block, even if it says `Consumes: none` or `Produces: none`.
- Do not default to commits; leave changes uncommitted unless the user explicitly asks for commit, push, PR, or an approved workflow includes commit handling.

## Self-Review

After writing the complete plan, check it against its source requirements, approved design, or spec. This is a checklist you run yourself, not a subagent dispatch.

**1. Requirement coverage:** Skim each binding requirement. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

**4. Contract propagation:** Did every task get the relevant `Global Constraints` and the exact `Interfaces` it consumes and produces? If a later task depends on a name, format, flag, or file from an earlier task, both tasks must say so consistently.

If you find issues, fix them inline. No need to re-review; fix and move on. If you find a binding requirement with no task, add the task.

## Execution Handoff

After saving the plan, choose the smallest execution mode supported by the user's request and Git permissions. If the user asked only for a plan, stop after reporting its path. If the user already asked for implementation, continue without another approval prompt:

**1. Subagent-Driven Development (when commit handling is approved)** - Use `skills/subagent-driven-development/SKILL.md` for independent tasks, task briefs, implementer report files, review packages, and the `.superpowers/sdd` progress ledger.

**2. Project-Agent Loop (no commits by default)** - Use this project's existing agents. Dispatch one fresh implementation subagent per task, then run two reviews before marking the task complete.

**3. Inline Execution (lightweight)** - Execute tasks in this session, task-by-task, with checkpoints. Use this for small, clear, tightly coupled work.

Default to Inline Execution for small, clear, tightly coupled work through `skills/executing-plans/SKILL.md`. Use the Project-Agent Loop when independent tasks materially benefit from context isolation. Ask the user only when commit/PR permission or a genuinely user-owned trade-off is missing.

**If Subagent-Driven Development chosen:**
- Confirm the user has approved commit handling, PR handling, or SDD-style execution. If not, use Project-Agent Loop or Inline Execution instead.
- Use `skills/subagent-driven-development/SKILL.md`.
- The SDD progress ledger and scratch artifacts live under `.superpowers/sdd/` and must stay out of commits.

**If Project-Agent Loop chosen:**
- Read the full plan once and extract each task with its files, tests, commands, and acceptance criteria.
- For each task, dispatch a fresh implementation subagent with only that task plus the necessary project context. Before dispatching, read the matching `agents/*.md` file and use its role, process, and constraints as the subagent prompt. In runtimes that do not expose custom agent names directly, dispatch a generic worker and seed it with the selected project-agent prompt.
- Pick the implementation agent by task shape:
  - `agents/tdd-guide.md` for new behavior, bug fixes, or behavior changes that need tests first
  - `agents/refactor-cleaner.md` for focused refactors
  - `agents/e2e-runner.md` for Playwright or user-flow verification tasks
  - a general worker if no specialized project agent fits
- Review stage 1: requirement/spec compliance. Use `agents/planner.md` or a generic review worker seeded with the spec and plan. Compare the implementation against the spec and this plan before judging style. If there is a gap, send it back to the same task implementer.
- Review stage 2: code quality. Use `agents/code-reviewer.md`, plus `agents/security-reviewer.md` or `agents/database-reviewer.md` when the touched area warrants it. If issues remain, send them back to the same task implementer and re-review.
- Mark the task checkbox complete only after tests pass and both review stages pass.

**If Inline Execution chosen:**
- Execute the plan in the current session.
- Keep the same order: implement one task, run its tests, do a requirement/spec compliance check, do a code quality check, then update the checkbox.

## Debugging Detour

If any task hits a bug, failing test, flaky behavior, or unexpected result, pause implementation and use `skills/systematic-debugging/SKILL.md`.

Do not stack quick fixes. Complete the four debugging phases, document the root cause briefly in the task notes, then return to the same task and re-run its required verification.

## Completion Loop

After all plan tasks are complete:

1. Apply `skills/verification-before-completion/SKILL.md`: identify the verification evidence required before any completion claim.
2. Run the project's verification flow (`/verify` or equivalent commands) to produce that fresh evidence.
3. If verification fails, use `skills/systematic-debugging/SKILL.md` for each failure class before changing code.
4. Run a final code review over the whole diff using `agents/code-reviewer.md`, adding `agents/security-reviewer.md` or `agents/database-reviewer.md` when relevant.
5. Use `/pr` when the user wants commit, push, or PR handling.
