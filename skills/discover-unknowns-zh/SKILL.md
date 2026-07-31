---
name: discover-unknowns-zh
description: 兼容旧未知项发现入口；用 iterative-retrieval 收敛事实缺口、风险假设与下一轮检索。
---

# Discover Unknowns Compatibility

这是至少保留一个发布周期的 **compatibility** 入口。

## When to Use

用户要求 unknown unknowns、盲点扫描、prototype、reference map、implementation notes、
explainer 或 quiz，或安全推进被系统性证据缺口阻塞时使用。

## How It Works

先把主题拆成事实、假设、盲点和低成本 probe，再按模式路由：

- blind-spot/reference map：`iterative-retrieval` + `evidence-research`；
- “做出来才知道”：`rapid-prototyping`；
- implementation notes：从代码、git 与验证证据形成可追溯记录；
- explainer：按领域词汇、机制、反例和边界解释；
- quiz：逐题检验理解，错误答案回到对应 evidence，不虚构事实。

所有模式都区分已证实事实、inference、未知项与下一证据来源；完成后返回
`skills/using-superpowers/SKILL.md`。

## Example

“给我画出这个支付模块的未知项 reference map，再用五题 quiz 检查理解”先做证据图，再逐题验证。

## Exit

返回 `UNKNOWN_MAP_READY`、`PROTOTYPE_QUESTION_READY`、`EXPLAINER_READY`、`QUIZ_COMPLETE` 或
`BLOCKED_BY_EVIDENCE_GAP`。

不要把未验证推断写成事实，也不因普通复杂度自动触发。
