---
name: using-git-worktrees
description: Use a worktree for every new feature; follow Git rules for other isolation needs and reuse a suitable task worktree.
---

# Using Git Worktrees

Reference: https://github.com/obra/superpowers

Worktree triggers are owned by `rules/05-git-workflow.md`: every new feature uses a task worktree,
including a single-file feature. Inspect first and reuse an existing suitable task worktree.

## Preconditions

- Use only inside a git repository.
- Read-only analysis needs no worktree. For non-feature changes, apply the isolation conditions in the Git rule;
  file count alone is not a trigger or an exemption.
- Never discard or overwrite existing user changes.
- If the current worktree has unrelated changes and the task requires broad edits, prefer a new worktree.
- Honor this repo's base-branch policy: when `rules/05-git-workflow.md` requires it, base on the latest upstream base (`origin/main`), never on an outdated local `main` or the current `HEAD`.

## Flow

1. Inspect repository state.

```bash
git status --short
git branch --show-current
git rev-parse --show-toplevel
```

2. Choose a branch name with the project convention. For Codex-managed branches, prefer `codex/<short-task-name>` unless the user requested another name.

3. Create the worktree from the base this repo's rules require (here `rules/05-git-workflow.md`): base on the latest required upstream, e.g. `origin/main`, not the current `HEAD` or an outdated local `main`.

```bash
git worktree add ../<repo-name>-<short-task-name> -b codex/<short-task-name> <base-ref>
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
