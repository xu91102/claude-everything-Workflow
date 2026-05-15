---
name: using-git-worktrees
description: Use before implementing substantial plans when work should be isolated from the current checkout, especially multi-step features, risky refactors, parallel agent work, or when the current worktree has unrelated user changes.
---

# Using Git Worktrees

Reference: https://github.com/obra/superpowers

Use a git worktree when implementation needs isolation without disturbing the user's current checkout. Keep this skill lightweight: inspect first, create only when it materially reduces risk.

## Preconditions

- Use only inside a git repository.
- Do not create a worktree for simple single-file edits, documentation tweaks, or quick read-only analysis.
- Never discard or overwrite existing user changes.
- If the current worktree has unrelated changes and the task requires broad edits, prefer a new worktree.

## Flow

1. Inspect repository state.

```bash
git status --short
git branch --show-current
git rev-parse --show-toplevel
```

2. Choose a branch name with the project convention. For Codex-managed branches, prefer `codex/<short-task-name>` unless the user requested another name.

3. Create the worktree from the current `HEAD` or an explicit base branch.

```bash
git worktree add ../<repo-name>-<short-task-name> -b codex/<short-task-name>
```

4. Run setup in the new worktree only when the project requires it. Do not reinstall dependencies if the project already supports shared caches or the task is docs-only.

5. Do all implementation, testing, and review inside the worktree. Keep the original checkout untouched except for user-approved coordination changes.

6. Before finishing, report:
   - worktree path
   - branch name
   - base commit or base branch
   - commands run
   - remaining cleanup, if any

## Cleanup

After the branch is merged, abandoned, or the user asks to clean up:

```bash
git worktree list
git worktree remove <worktree-path>
git branch -d codex/<short-task-name>
```

Use `git branch -D` only when the user explicitly confirms deleting an unmerged branch.

## Safety

- Do not run destructive cleanup from a computed path unless the absolute target path has been verified.
- Do not create nested worktrees inside another worktree.
- Do not use worktrees as a substitute for understanding the current dirty state; inspect first.
