---
name: implement
description: Deliver an approved tracker ticket with acceptance, claim/resolve authorization and integration verification.
---

# Implement

执行已批准 ticket 的专项交付。Origin: `mattpocock/skills@2ab9580`，适配本项目授权与审查边界。

## 入口

仅执行已批准的 tracker ticket；普通开发直接使用宿主能力，不加载本 Skill。
先读取 [references/ticket-delivery.md](references/ticket-delivery.md)，确认验收、frontier 和相应授权。
无 ticket 范围不得 claim 或写入任何 tracker。尚未批准的必需 Spec 或关键用户决策需先解决。

## 隔离与基线

检查 branch、worktree、staged、unstaged 和 untracked，记录 `git rev-parse HEAD` 为 pre-delivery base，
并记录 task-owned 改动。已有无关改动必须排除，不能回滚。

是否创建 worktree 及具体操作按 `rules/05-git-workflow.md` 执行，不嵌套创建。
只做必要 setup 与相关 baseline tests。
按 `rules/common/testing.md` 分类基线失败：目标失败是有效复现，可以继续修复；已证实无关的历史失败记录后继续；影响结果判断的环境或相关失败需处理或明确报告验证受阻。不得伪装通过。

## 实施、审查与验证

1. 以当前范围合同实施最小完整改动，不再生成逐文件、逐步骤的实施计划。测试方法按
   `rules/common/testing.md` 选择；采用 TDD 时读取 `test-driven-development`，纯文档或没有可测试行为的整理运行对应校验。
   已确认失败原因正确的预期 TDD RED 继续 GREEN，不触发调试。其他失败按
   `systematic-debugging` 的分级入口处理，不跳过真实失败。
2. 用 pre-delivery base 冻结包含 task-owned committed、staged、unstaged、untracked 的完整审查包，
   范围合同作为 Spec source，按 `skills/code-review/SKILL.md` 选择相称的 review 模式。
   满足该 Skill 的低风险与验证条件时可自审；需要独立审查却无法启动时不得降级。
   修复 Critical/Important findings 后复核受影响的验收与审查项，不把部分完成报告为交付完成。
3. 逐条核对验收，按 `rules/common/testing.md` 运行 fresh commands。已在当前阶段运行且仍对应
   最终改动的证据可以复用；新改动、失败或未决风险才触发重跑。记录实际结果、未运行项和剩余风险。

## 收尾与授权

- ticket：验收、review 和 verification 全部通过后，回到 ticket 引用完成 resolve 与后续处理。
- 本地交付授权不覆盖 commit、push 或创建 PR，也不扩张产品范围。用户已明确授权的后续动作按授权继续，
  不重复索要同一批准；PR 仍须通过 `/verify pre-pr`。外部写入、merge 和 cleanup 遵循 Git 规则与用户授权。
