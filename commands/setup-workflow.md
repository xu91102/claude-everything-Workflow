---
description: 显式初始化项目工作追踪、领域文档与 ADR 位置
---

# /setup-workflow - 项目上下文初始化

读取并执行 `skills/project-context/SKILL.md`，把 `$ARGUMENTS` 和当前仓库作为输入。

此命令是可选的显式设置：先探测并展示草案，只有用户批准后才写入
`docs/agent-workflow/project-context.md`。不要在 command 中复制配置协议；
`skills/project-context/SKILL.md` 是唯一事实来源。
