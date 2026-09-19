# Claude Everything Workflow

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/xu91102/claude-everything-Workflow/actions/workflows/ci.yml/badge.svg)](https://github.com/xu91102/claude-everything-Workflow/actions/workflows/ci.yml)

**A reusable engineering workflow for Claude Code and Codex.**

**English** · [简体中文](README.zh-CN.md)

Give your coding agent a consistent way to investigate problems, implement changes, review work, and report what was actually verified. Claude Everything Workflow (CEW) packages rules, task-specific skills, command entry points, and supporting scripts into an installable agent harness—the instructions and tools around your agent.

CEW works with your existing projects and model. It does not provide a model or replace Claude Code or Codex. The README is available in English and Chinese; most bundled workflow instructions are currently written in Chinese.

[Install](#installation) · [How it works](#how-it-works) · [Design principles](#design-principles) · [Documentation](#documentation)

## What it helps you do

| Task | What CEW adds |
| --- | --- |
| Deliver a change | A path from a clear request to implementation, review, and verification. |
| Investigate a bug | Call-chain tracing, testable hypotheses, targeted experiments, and evidence-based root-cause reports. |
| Review code | Review against a fixed baseline and agreed scope, with depth matched to risk. |
| Handle larger work | Specification, dependent tickets, isolated parallel work, and handoff tools when needed. |
| Keep context focused | Small entry points and references loaded for the relevant task. |
| Report progress honestly | Separate claims for diagnosis, fixes, tests, CI, and release status. |

## Installation

**Claude Code and Codex plugins are also supported**, with GitHub marketplace installation and updates. The npm installer remains available. See [plugin installation and updates (Chinese)](docs/plugins.md).

### Requirements

- Claude Code and/or Codex, already installed and configured.
- Node.js **18+** and npm/npx.
- macOS/Linux: Bash and `rsync`. Windows: PowerShell; Git Bash/WSL can use the shell installer if Bash and `rsync` are available.

### Install from npm

Preview the changes, then install to both hosts:

```sh
npx claude-everything-workflow install --dry-run
npx claude-everything-workflow install
```

To install for only one host:

```sh
npx claude-everything-workflow install --claude-only
npx claude-everything-workflow install --codex-only
```

### Install from source

```sh
git clone https://github.com/xu91102/claude-everything-Workflow.git
cd claude-everything-Workflow
npm install --ignore-scripts --no-package-lock
node bin/claude-everything-workflow.js install --dry-run
node bin/claude-everything-workflow.js install
```

The CLI selects the shell or PowerShell installer for your platform. The same `--claude-only` and `--codex-only` options apply. The npm command uses the published package; the source command uses your checkout.

### What changes on your machine

| Host | Destination | Integration |
| --- | --- | --- |
| Claude Code | `~/.claude/` | Shared workflow files, `CLAUDE.md` bootstrap, rules, and merged hook settings. |
| Codex | `~/.codex/` | Shared workflow files and `AGENTS.md`; Claude Code hooks are not automatically enabled. |

Installation updates user-level files and can affect multiple projects. Changed top-level configuration files are backed up; matching files inside shared directories are synchronized from the repository. Unknown files are generally retained, while known retired files are removed by an explicit cleanup list. Back up any personal edits to shared files before upgrading. Use the installer instead of copying the entire `rules/` directory: it handles the different rule locations used by each host.

## How it works

Start with a normal task request. The workflow router selects relevant skills; you do not need to memorize every skill name.

```text
Request → inspect context → select the relevant workflow
        → investigate / implement → review → verify → report evidence
```

For example:

> Find why this request intermittently fails. Trace the actual call chain, test the competing explanations, and fix the confirmed cause. Report the verification results and anything still unverified.

Clear, low-risk work can take a short route. Unresolved user decisions, formal specifications, and work with costly-to-reverse consequences receive additional attention. Multi-session tickets and parallel agents are available for work that benefits from them. Exact routing and approval boundaries live in the [router](skills/using-superpowers/SKILL.md) and [project rules](AGENTS.md).

| Entry point | Purpose |
| --- | --- |
| `/to-spec` | Prepare a formal engineering specification for approval. |
| `/code-review` | Review a defined change against its scope and baseline. |
| `/verify` | Run the relevant verification checks. |
| `/pr` | Prepare commits and a pull request within the user's authorization. |
| `/learn` | Explicitly manage reusable learning and its evaluation. |

These are repository command definitions; availability as native slash commands depends on the host. Ordinary language can also express the intended workflow.

## Design principles

1. **Evidence before claims.** A plausible explanation is not a confirmed root cause. A passing local check is not a production release.
2. **The shortest appropriate workflow.** Match the process and verification effort to the task and risk; do not create artifacts just to satisfy a template.
3. **Load context when needed.** Keep entry points small and load specialized rules, skills, and references only when relevant.
4. **Respect project conventions and user control.** Preserve existing work and follow the target project's requirements. Installing a skill does not authorize publishing, external writes, or destructive actions.
5. **One owner per policy.** Keep routing, Git boundaries, and verification requirements in their designated sources rather than duplicating competing rules.

These instructions guide agent behavior; they are not a runtime security boundary or a guarantee of successful diagnosis. Repository validation checks structure and contracts. Real task performance needs separate evaluation.

## Repository structure

```text
claude-everything-Workflow/
├── README.md             # English overview
├── README.zh-CN.md       # Chinese overview
├── LICENSE               # MIT license
├── AGENTS.md             # Shared policy entry point
├── CLAUDE.md             # Claude Code bootstrap
├── skills/               # Task-specific workflows
├── rules/                # Project and specialist rules
├── commands/             # Command entry points
├── agents/               # Specialized agent definitions
├── hooks/                # Hook implementations
├── scripts/              # Installers and validators
├── references/           # Detailed guides and supporting material
└── harness/              # Skill metadata and ownership manifest
```

## Documentation

- [Skill catalog](skills/README.md) — available workflows and their categories (Chinese).
- [Debugging workflow](skills/systematic-debugging/SKILL.md) — investigation and completion criteria.
- [Verification rules](rules/common/testing.md) — evidence needed before declaring work complete.

## Development

From a source checkout with dependencies installed:

```sh
npm run verify
npm run test:manifest
npm run test:invocation
npm run test:continuation
npm run test:install-rules
npm run verify:upstream
npm run pack:dry-run
```

`verify:upstream` checks the recorded capability mapping; it does not establish parity with the latest upstream version. `npx claude-everything-workflow verify` validates the published distribution rather than your local project. Neither command proves an agent's effectiveness on real tasks.

For contributions, describe the problem and expected behavior, keep the change focused, and include the checks you actually ran. See the [Git rules](rules/05-git-workflow.md).

## Acknowledgments

CEW draws on [Everything Claude Code](https://github.com/affaan-m/everything-claude-code), [Superpowers](https://github.com/obra/superpowers), and [Matt Pocock's skills](https://github.com/mattpocock/skills), adapting their ideas to this repository's workflows.

## License

Released under the [MIT License](LICENSE). Copyright © 2026 xu91102.
