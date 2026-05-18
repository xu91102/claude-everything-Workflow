---
description: 查看学习到的模式、置信度和待审查状态
---

# /instinct-status - 学习状态

显示学习到的直觉、置信度、证据数量和待审查状态。

## 使用方式

```text
/instinct-status
/instinct-status --domain testing
/instinct-status --high
/instinct-status --review
/instinct-status --review --scope project
/instinct-status --review --scope global
```

## 状态规则

- 置信度不会因时间流逝自动衰减。
- 长期无观察只标记为待审查。
- 待审查项由用户决定保留、更新、合并、归档或删除。
- 此命令不直接删除文件。

## 输出内容

- 总直觉数量和按置信度分布。
- project/global/legacy 分层统计。
- 高置信度、低置信度和待审查列表。
- 每项的证据数量、最后观察时间和建议动作。
- `/evolve` 候选建议。

## 审查模式

`--review` 调用 `scripts/learning/review-confidence.js` 生成审查报告。
报告只标记待审查，不修改置信度。
