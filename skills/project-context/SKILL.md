---
name: project-context
description: 配置仓库长期使用的 tracker、领域文档与 ADR 位置。
disable-model-invocation: true
---

# Project Context

Set up a small, versioned source of truth that tells agents where this repository tracks work,
domain vocabulary, and durable decisions. This is an explicit setup action, not a workflow gate.

## Boundary

- Only when the user explicitly asks for this setup; never run it automatically from routing.
- Inspect discoverable facts before asking a question. Do not create, edit, or call external systems
  until the user approves the proposed configuration.
- Store the configuration at `docs/agent-workflow/project-context.md`. Do not create an empty `CONTEXT.md`,
  empty ADR directory, placeholder Issues, or tracker labels.
- Record tracker coordinates and operating rules only. Do not infer credentials, create remote
  Issues, or select a connector that is not available in the current runtime.

## Discover

Inspect only the current repository and existing project documentation:

1. Root `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, and `CONTEXT-MAP.md`.
2. Existing ADR directories, `docs/agent-workflow/`, `.scratch/`, and project-local tracker notes.
3. Git remotes and existing issue references, without accessing remote tracker data unless the user
   separately asks for it.
4. Monorepo signals such as workspace manifests and package directories.

Report found facts, conflicts, and missing inputs concisely. Existing confirmed configuration wins;
reopen it only when the user asks to change it or its referenced path no longer exists.

## Resolve configuration

Resolve only choices not settled by repository facts, one at a time. Give a recommendation and
why it fits the discovered repository:

1. **Work tracking**: `github`, `jira`, `linear`, `local-markdown`, or `custom`. Prefer the
   configured remote or an existing local convention; record URL/project key/path and the allowed
   tool or CLI, if any.
2. **Domain layout**: `single-context` at `CONTEXT.md`, or `multi-context` with a root
   `CONTEXT-MAP.md`. Prefer multi-context only when the repository is a real monorepo with
   independent domains.
3. **Decision records**: record the existing ADR directory, or recommend `docs/adr/` only when a
   durable decision is ready to document.

If no decision is needed, present the discovered default for confirmation rather than asking a
synthetic question.

## Draft and persist

1. Fill `references/project-context-template.md` with confirmed values and show the full proposed
   path and content before writing.
2. After explicit approval, create or update only `docs/agent-workflow/project-context.md`.
   Preserve user-maintained sections outside the managed headings.
3. Create `CONTEXT.md`, `CONTEXT-MAP.md`, or an ADR only when the user has approved concrete
   vocabulary or a qualifying decision. Delegate their content rules to `domain-modeling`.
4. Do not edit root instructions merely to advertise this setup; consumers discover the standard
   configuration path when it exists.

## Handoff

Return one outcome:

```text
CONFIGURED
- config_path
- work_tracking
- domain_layout
- adr_location
- remaining_risks

NEEDS_DECISION
- decision
- evidence
- recommended_default

NOT_APPLICABLE
- reason
```

After `CONFIGURED`, return to the caller. Do not start planning, implementation, or external
tracker actions.
