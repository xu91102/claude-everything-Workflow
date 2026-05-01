---
description: Harness 审计入口，薄封装委派 harness-optimizer agent
---

# /harness-audit - Harness 审计

这是 `agents/harness-optimizer.md` 的 slash 入口，不重复维护 Harness 审计清单。

## 使用方式

```text
/harness-audit
/harness-audit hooks agents skills
```

## 执行规则

1. 优先委派 `harness-optimizer` agent。
2. 只传入审计范围、当前目标和用户指定的约束。
3. 输出问题证据、最小可逆建议、预期效果、风险等级和验证方式。
4. 默认只提出建议；修改文件前必须回到主流程确认具体变更。
5. 如果无法委派 agent，主模型按 `rules/common/harness-engineering.md` 做只读审计。

## 参数

`$ARGUMENTS`

