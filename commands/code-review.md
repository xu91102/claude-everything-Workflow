---
description: 代码审查入口，薄封装委派 code-reviewer agent
---

# /code-review - 代码审查

这是 `agents/code-reviewer.md` 的 slash 入口，不重复定义审查流程。

## 使用方式

```text
/code-review
/code-review --staged
/code-review path/to/file.ts
```

## 执行规则

1. 优先委派 `code-reviewer` agent。
2. 只传入审查范围、相关 diff、必要文件路径和用户参数。
3. agent 只读审查，不直接修改代码。
4. 输出按严重性排序的问题、证据位置、风险和测试缺口。
5. 如果无法委派 agent，主模型按代码审查模式执行同等只读审查。

## 参数

`$ARGUMENTS`
