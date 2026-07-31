---
name: research
description: "Investigate a question against high-trust primary sources and persist a cited Markdown report. Use when external documentation, source code, standards, APIs, papers, or delegated reading are needed; not for a narrow local code search already handled by iterative-retrieval."
---

# Research

Origin: `mattpocock/skills@2ab9580`, adapted to this repository's agent and artifact rules.

## Contract

1. Define the question, decision it informs, source quality threshold and output location.
2. Use a background subagent when the runtime permits and the research can proceed independently.
   Continue useful local work while it reads.
3. Prefer primary sources: official documentation, owner source code, specifications, first-party APIs
   and original papers. Use secondary sources only to locate or contrast primary evidence.
4. Trace every material claim to the source that owns it.
5. Save one Markdown report in the repository's configured research/scratch convention. If none exists,
   use `.unknowns/<topic>-research.md` and report the path.
6. Put citations beside claims, distinguish source fact from inference, record source dates/versions,
   conflicts and unresolved gaps, citing each claim that changes the conclusion.
7. Do not change production code, external systems or project decisions.

## Background Agent Brief

Pass only:

- research question and decision context;
- allowed scope and preferred primary sources;
- output path;
- required report sections and citation contract.

Do not leak an expected answer. The subagent returns a short conclusion and the report path; the file is
the authoritative artifact.

## Report Shape

```markdown
# Question
## Conclusion
## Primary-source findings
## Conflicts and uncertainty
## Implications for the decision
## Sources
```

Return the report to `skills/using-superpowers/SKILL.md`. Research supplies evidence; it does not own
requirements, approval or implementation.
