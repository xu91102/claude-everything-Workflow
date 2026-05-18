---
description: 评估学习模式是否值得演化为 skill、agent 或 command
---

# /evolve - 演化评估

分析学习到的模式，提出是否演化为 `skill`、`agent` 或 `command` 的建议。
默认只输出计划，不创建文件。

## 使用方式

```text
/evolve
/evolve --domain testing
/evolve --apply
```

## 演化规则

- 优先演化为 `skill`: 自动触发、可复用、上下文成本可控的能力。
- 其次演化为 `agent`: 多步骤、需要隔离上下文或专门工具权限的任务。
- 谨慎演化为 `command`: 只有用户会明确主动触发，且 skill/agent 不足以表达时才创建。

## 执行流程

1. 读取 `skills/learn/<category>/`、project instincts 和 global instincts 中的相关模式。
2. 聚类相似触发条件、动作和证据。
3. 输出候选演化类型、理由、风险和预计 token 影响。
4. 默认只生成建议。
5. 使用 `--apply` 时，也必须先展示将创建或修改的文件，得到用户确认后再写入。

## 项目隔离

- 默认优先分析当前 project instinct。
- 只有跨项目复用价值明确时，才建议先走 `/promote --dry-run` 再演化。
- legacy `~/.claude/homunculus/instincts` 仅作为迁移前兼容来源。

## 输出要求

- 每个候选项给出证据来源。
- 标注推荐类型: `skill`、`agent`、`command` 或“不演化”。
- 标注风险等级和回滚方式。
