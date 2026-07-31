---
name: handoff
description: "Compact the current work into a redacted Markdown handoff for a fresh session. Use when the user explicitly requests /handoff, when a prototype detour needs an isolated session, or when the active context is leaving its reliable reasoning zone."
---

# Handoff

Bridge one context window to a fresh session without copying the repository or mutating project files.

Origin: `mattpocock/skills@2ab9580`, adapted to this repository's write-safety and verification contracts.

## Preconditions

- Use only for a fresh session or an intentional prototype branch. Built-in compaction is for continuing
  the same conversation at a phase boundary.
- Creating the handoff document is authorized only by an explicit `/handoff` request or explicit approval
  after the router recommends it.
- Resolve the operating system's temporary directory with the available runtime. Create a unique
  private subdirectory with mode `0700`; fail closed if permissions cannot be enforced. Do not write
  the handoff into the repository, tracker, home directory, or a guessed path.

## Build the document

Create one uniquely named Markdown file inside that private directory using exclusive creation, then
enforce mode `0600` before content is written. Never overwrite or follow an existing path. Include:

1. current objective and intended next-session focus;
2. completed work and current status;
3. confirmed decisions, constraints, and user authorizations;
4. unresolved decisions, blockers, and remaining risks;
5. repository/worktree/branch state when relevant;
6. verification already run and its exact outcome;
7. the smallest concrete next actions;
8. a `Suggested skills` section naming only skills the next session should load.

Do not duplicate content already preserved in Specs, plans, ADRs, tickets, commits, diffs, or research
artifacts. Reference each durable artifact by exact path, URL, commit, or ticket identifier and summarize
only why it matters.

Redact secrets, credentials, tokens, private keys, personal data, and unrelated sensitive output. Do not
invent missing facts. Mark uncertainty explicitly.

## Return contract

After writing, verify that the file exists and is readable. Return:

- the exact path;
- the intended next-session focus;
- instructions to open a fresh session and reference that path;
- instructions for the fresh session to delete the handoff after consumption, remove its now-empty
  private directory, and verify both removals;
- any information intentionally omitted or redacted.

Do not continue the old workflow after returning the handoff. The fresh session re-enters
`skills/using-superpowers/SKILL.md` and loads the suggested skills from disk before acting.
