---
name: systematic-debugging
description: Diagnose unexplained, repeated, or flaky failures; expected TDD RED continues implementation.
---

# Systematic Debugging

## 分级入口

- 已确认失败原因正确的预期 TDD RED：回到实现的 GREEN，不加载完整诊断参考。
- 原因已由错误信息和调用链证实的普通失败：最小修复并重跑对应验证，不制造多个假设。
- 根因不明、修复后仍重复失败、flaky 或性能回归：进入完整诊断。先取得可重复的反馈，
  再读取 `references/diagnosing-bugs.upstream.md`，按其中适用阶段执行；跳过不适用阶段时记录依据。

所有路径都保留原始症状和修复后的验证证据。不能把非目标错误当作预期 RED，也不能跳过真实失败。

## 项目运行适配

上游六阶段原文及 `scripts/hitl-loop.template.sh` 作为上游原始 Bash 模板留档，保持原样。
当上游原文提到 HITL Bash 或 `.sh` 路径时，项目实际运行一律替换为
`scripts/hitl-loop.template.js`。它是 HITL 的唯一运行入口；不要执行留档的 Bash 模板。
