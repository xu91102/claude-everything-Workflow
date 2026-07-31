---
name: architecture-audit
description: 扫描代码库中的 deepening opportunities，生成可视化 HTML 报告，并对用户选中的候选做压力测试。
disable-model-invocation: true
---

# Architecture Audit

寻找能把 shallow module 深化为 deep module 的机会，目标是 testability、locality 与
AI-navigability；不借“架构优化”扩大产品范围。

## When to Use

用户要求扫描架构健康、testability 或 deepening opportunity 时使用；不因普通重构自动触发。

## How It Works

1. 读取 `deep-module-design`、领域词汇、相关 ADR 与仓库规则。
2. 用户指定范围时严格遵守；否则用 `git log` 和变更频率选择热点，再逐步扩大。
3. 记录理解摩擦、跨文件跳转、泄漏的 Interface、难测 Seam、重复 Adapter 与缺乏 Locality。
4. 对每个候选做 **deletion test**：删掉后复杂度是否会散回多个调用方？
5. 丢弃没有真实变化需求、只有一个虚构 Adapter 或收益无法验证的抽象。

## Report

在 OS 临时目录创建自包含 **HTML** 报告，不写仓库。报告按收益/风险排序，每个候选包含：

- 当前 Module、Interface、Seam 和证据位置；
- shallow 原因及 deletion test 结论；
- 建议的 deep Interface、迁移切片和可回滚点；
- Leverage、Locality、测试面收益与代价；
- 当前与目标关系图；需要关系图时使用 Mermaid，否则使用简单 HTML/CSS。

打开报告前告诉用户绝对路径；无法打开时仍返回路径。外部 CDN 不得成为读取报告的必要条件。

## Select and Handoff

让用户选择候选；选中后使用 `grilling` 一次解决一个 consequential decision，并以
`deep-module-design` 词汇形成 design handoff。只产出已选候选的方案与验证 seam，不直接重构。
若没有可靠候选，报告证据并结束。

## Example

“审查最近频繁修改的支付模块，找最值得深化的两个 seam”以 git 热点限定扫描并生成 HTML。

## Exit

返回 `AUDIT_READY`（报告路径与候选）、`DESIGN_HANDOFF_READY` 或 `NO_RELIABLE_CANDIDATE`。
