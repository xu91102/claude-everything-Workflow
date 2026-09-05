---
name: systematic-debugging
description: Diagnose reported failures, regressions, slowness, or flaky behavior from the real call chain.
---

# Systematic Debugging

先完整读取 `references/diagnosing-bugs.upstream.md`，严格按其中六阶段的原始顺序与门禁执行；
不得改写、缩减或跳过阶段，除非原文明确允许并记录理由。

## 项目运行适配

上游六阶段原文及 `scripts/hitl-loop.template.sh` 作为上游原始 Bash 模板留档，保持原样。
当上游原文提到 HITL Bash 或 `.sh` 路径时，项目实际运行一律替换为
`scripts/hitl-loop.template.js`。它是 HITL 的唯一运行入口；不要执行留档的 Bash 模板。
