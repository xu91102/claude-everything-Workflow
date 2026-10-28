---
name: implement
description: Deliver one authorized scope through implementation, review, and verification.
---

# Implement

交付原始用户请求、获批 Spec 或 ticket 所定义的一个范围（direct-scope contract）。实现摘要不能扩大授权。
普通交付使用当前会话，不为满足流程创建 Spec、tracker 或新上下文；无 ticket 范围不得 claim 或写入任何 tracker。
仅有 ticket 时读 [ticket-delivery](references/ticket-delivery.md)。未决实质用户决策或尚未批准的高风险边界返回路由。

## 基线与隔离

检查 branch、staged/unstaged/untracked，记录 pre-delivery base 和 task-owned 改动，保留无关用户改动。
按[Git 与授权规则](../../references/git-workflow.md)判断是否隔离，复用本任务已有合适工作区，不嵌套创建。
只做必要 setup 和基线检查。clean baseline 指输入与环境已辨明；已确认属于目标问题的测试失败就是回归证据，
不要求先修到绿色才能实施。非目标失败单列处理，不能当作预期 RED 或伪装通过。

## 实施、验证、审查

1. 修改前确认目标行为、受影响调用方和需保留的契约，再做最小修复。已有能证明问题的失败测试直接复用；需要新增或修改
   行为断言、或用户要求测试先行时才读取 [test-driven-development](../test-driven-development/SKILL.md)。
   原因明确的普通失败直接修复；未知根因或重复失败才读取调试流程，正确的 TDD RED 不触发重路由。
2. 按项目/用户验证合同选最小充分检查；没有适用规则时用[随包验证契约](../../references/verification.md)。
   证据已覆盖最终状态且相关输入未变时直接复用；新改动、失败或未决风险才重跑受影响检查。
3. 按[审查分级](../code-review/references/review-policy.md)选择强度。self 直接核对用户要求、完整实际差异及证据，
   不加载独立审查提示。需要 independent/dual 时读取完整 [code-review](../code-review/SKILL.md)，
   使用固定基点、原始需求和完整 task-owned 差异；必要独立审查不能因缺少容量降级或写成通过。
4. 修复重要发现后复核受影响项；已验证且输入未变的其他证据继续复用。验收、必要审查和适用质量门均满足才完成。

## 收尾与授权

报告实际改动、已运行命令/结果、未运行项及剩余风险；部分完成不得写成全部交付。
无 ticket 到此结束；ticket 依其引用继续 resolve/refresh，不能自行关闭外部 Issue。
本地交付不覆盖 commit、push 或创建 PR；已有明确授权直接沿用，不重复索要批准。
PR 前按 [verify](../../commands/verify.md) 复用并补齐适用证据；不因进入 pre-pr 自动重跑同一检查。
