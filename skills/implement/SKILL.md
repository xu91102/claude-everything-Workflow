---
name: implement
description: "Deliver one authorized scope through implementation, review, and verification. Load the tracker lifecycle only when executing a ticket."
---

# Implement

执行 router 选定的一个连贯交付范围。Origin: `mattpocock/skills@2ab9580`，适配本项目授权与审查边界。

## 入口

- direct scope：明确、低风险的用户交付请求。原始请求、目标行为、范围边界和相称验证组成
  `direct-scope contract`；咨询不等于交付授权。
- approved Spec scope：已获用户批准的 Spec 是范围与验收来源。
- ticket：仅此路径先读取 [references/ticket-delivery.md](references/ticket-delivery.md)，核实 frontier，
  再按该引用与下方共用步骤交付。无 ticket 范围不得 claim 或写入任何 tracker。

缺少可复核验收、存在实质用户决策或命中尚未批准的 formal Spec/高风险边界时，返回 router，不能猜测或实施。
普通范围使用当前会话，不为满足流程创建新的上下文或 tracker。

## 隔离与基线

检查 branch、worktree、staged、unstaged 和 untracked，记录 `git rev-parse HEAD` 为 pre-delivery base，
并记录 task-owned 改动。已有无关改动必须排除，不能回滚。

是否创建 worktree 以 `rules/05-git-workflow.md` 为准；需要隔离时使用
`skills/using-git-worktrees/SKILL.md`，不嵌套创建。只做必要 setup 与相关 baseline tests。
只有 clean baseline 才进入实施；失败时记录命令、失败与工作区状态，返回 router 处理，不能伪装通过。

## 实施、审查与验证

1. 以当前范围合同实施最小完整改动，不再生成逐文件、逐步骤的实施计划。行为变化按
   `test-driven-development` 的垂直切片推进；纯文档或没有可测试行为的整理运行对应校验。
   出现失败测试、flaky 或意外结果时进入 `systematic-debugging`，修复后再继续。
2. 用 pre-delivery base 冻结包含 task-owned committed、staged、unstaged、untracked 的完整审查包，
   范围合同作为 Spec source，执行 `skills/code-review/SKILL.md` 的 Standards/Spec 双轴 review。
   任一轴未通过时修复 Critical/Important findings 后重审，不把部分完成报告为交付完成。
3. 逐条核对验收，按 `verification-before-completion` 运行 fresh commands。已在当前阶段运行且仍对应
   最终改动的证据可以复用；新改动、失败或未决风险才触发重跑。记录实际结果、未运行项和剩余风险。

## 收尾与授权

- 无 ticket：双轴 review 与 fresh verification 均通过后报告范围、证据和风险；到此结束，不查询或刷新 frontier。
- ticket：验收、review 和 verification 全部通过后，回到 ticket 引用完成 resolve 与后续处理。
- 本地交付授权不覆盖 commit、push 或创建 PR，也不扩张产品范围。用户已明确授权的后续动作按授权继续，
  不重复索要同一批准；PR 仍须通过 `/verify pre-pr`。外部写入、merge 和 cleanup 遵循 Git 规则与用户授权。
