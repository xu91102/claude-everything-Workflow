---
name: resolving-merge-conflicts
description: "Resolve an in-progress Git merge or rebase conflict hunk by hunk from both sides' primary intent, then verify and finish only within the user's Git authorization. Use when conflict markers or an active merge/rebase state exists."
---

# Resolving Merge Conflicts

Origin: `mattpocock/skills@2ab9580`, adapted to this repository's Git authorization rules.

1. Inspect the exact Git state, merge base, conflicting paths and pending commits. Do not abort,
   reset or discard either side.
2. For each side, trace intent to primary sources: commit messages, diffs, tests, issue/PR references,
   specifications and surrounding code.
3. Resolve one hunk at a time:
   - preserve both intents when compatible;
   - when incompatible, follow the stated merge/rebase goal and documented contract;
   - report the trade-off;
   - do not invent unrelated behavior.
4. Search for semantic conflicts outside marker lines: renamed symbols, duplicated migrations,
   mismatched schemas, tests or configuration.
5. Run the repository's formatting, type, test and build checks in risk order. Fix only breakage caused
   by the integration.
6. Show the resolved files, intent decisions, checks and remaining risks.
7. Stage, commit or continue the merge/rebase only when the user's request already authorizes those Git
   mutations; otherwise stop with the exact commands/actions awaiting approval.

Never use `git reset --hard`, destructive checkout, broad clean or `--abort` as a shortcut.
