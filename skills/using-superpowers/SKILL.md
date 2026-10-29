---
name: using-superpowers
description: Route engineering delivery and explicitly requested engineering workflows; resume their process outcomes.
---

# Using Superpowers

Own routing and continuation. Choose the shortest applicable path; do not preload a chain of Skills.
用户、项目及已生效 Rules 优先于本包默认值。下列相对链接属于当前分发包，不要求向目标项目安装规则。
普通问答、翻译与资料总结直接处理。工程任务先识别原始需求、可查事实、真实用户决策和风险。

## Three Lanes

The three lanes are: direct (clear low-risk task), needs-decision, and formal-spec.
File count, new features, and ordinary complexity affect verification intensity, not the lane.
A high-risk boundary is a costly-to-reverse architecture/service decision, breaking public contract,
authorization, persistent data/schema migration, or irreversible side effect. 按既有契约修复公开函数不自动改变公共契约。

## Routing

按当前决策选一个入口；高风险条件优先，用户明确指定的流程优先于默认路径。

| 当前情况 | 动作 |
| --- | --- |
| explicit workflow advice | 只说明入口、前提和验收，不实施、不写文件或 tracker |
| discoverable fact | 先检查文件、状态或主要来源，不反问用户 |
| unresolved user-owned decision? | 普通任务直接问一个实质问题（grilling inline），等待答案后接续；不为单问题加载访谈流程 |
| explicit formal Spec or high-risk boundary? | [skills/spec-gate/SKILL.md](../spec-gate/SKILL.md)；未解决用户决策时先澄清，resume_target: spec-gate；批准后才实施 |
| explicit grilling request / explicit documented grilling request | [grilling explicit](../grilling/SKILL.md)；要求持久领域文档时才加 [domain-modeling](../domain-modeling/SKILL.md) |
| 原因已由错误与调用链证实的普通 bug | 最小修复及原问题回归；不自动进入完整诊断 |
| 根因不明、重复失败、flaky 或性能回归 | [systematic-debugging](../systematic-debugging/SKILL.md)；预期 TDD RED 留在实现循环 |
| 无行为变化的文字或格式修正 | 直接修改、核对差异并运行适用校验，不生成 Spec/ticket 或加载完整实现/TDD/审查链 |
| 清晰且获准的可逆交付范围 | [skills/implement/SKILL.md](../implement/SKILL.md) |
| explicit TDD request，或需要新增行为断言 | [test-driven-development](../test-driven-development/SKILL.md) |
| explicit project verification setup/maintenance 或真实流程验收 | [feature-acceptance](../feature-acceptance/SKILL.md)；普通完成验证不触发工具建设 |
| explicit E2E / Playwright request | [e2e-testing](../e2e-testing/SKILL.md) |
| active merge/rebase conflict | [resolving-merge-conflicts](../resolving-merge-conflicts/SKILL.md) |
| explicit handoff、triage、architecture-health audit | 分别用 [handoff](../handoff/SKILL.md)、[triage](../triage/SKILL.md)、[improve-codebase-architecture](../improve-codebase-architecture/SKILL.md)；自然语言请求有效 |
| explicit prototype | [prototype](../prototype/SKILL.md)，由其区分逻辑/UI 验证及视觉工具同意条件 |
| explicit harness audit / skill discovery / external skill learning | 按请求使用 `agents/harness-optimizer.md`、宿主发现能力或 [技能维护规则](../../rules/common/skills-learning.md) |

普通单问题直接澄清；只有显式访谈或正式流程需要其完整交接协议时才读取 grilling。
不要要求用户改用命令或重复已有授权。相关 Skill 已读且未变化时复用；返回路由不等于重读此文件。
批量读取当前已知且独立的状态、实现、测试与规则片段；依赖先前结果的后续动作顺序执行。

## Delivery Topology

默认在当前会话用 implement 交付一个连贯范围；开始时简述选择及原因。
只有确需持久跨会话依赖图才进入 [to-tickets](../to-tickets/SKILL.md)，发布前批准 ticket contract。
仅当至少两张已批准、无 blocker 且写入面独立的 frontier tickets 可安全并行时进入
[subagent-driven-development](../subagent-driven-development/SKILL.md)；不人为拆票或为普通任务建 tracker。
隔离按 [Git 规则](../../references/git-workflow.md)，不因任务清晰省略用户改动保护或必要隔离。

## Process Outcomes

仅处理 grilling/Spec outcome 或跨会话交接时读
[references/process-outcomes.md](references/process-outcomes.md)。Ordinary direct delivery does not load this reference.
现有范围授权不扩张到新的产品范围、未决用户决策、tracker、commit、push、PR、merge 或发布；已有相应授权直接沿用。

## Compatibility Alias

For one release cycle, interpret the old name `brainstorming` as `/to-spec`；不恢复旧入口或第二套协议。

## Completion

按[审查分级](../code-review/references/review-policy.md)和适用验证规则收尾；无项目/用户验证规则时用
[随包验证契约](../../references/verification.md)。同一最终状态的有效证据复用，不为完成或提交重复跑检查。
