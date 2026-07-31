---
description: 显式询问当前工程任务应使用哪条 workflow
---

# /workflow-router

这是用户显式入口。读取并遵循 `skills/using-superpowers/SKILL.md`，只做路由说明，不自动
执行 user-invoked skill，也不改变用户请求。

输出当前起点、推荐的最窄流程、为何适用、下一项显式命令，以及不应采用的重型流程。
没有工程目标时返回 `NOT_APPLICABLE`。只建议下一项显式入口并写明“不隐式执行
user-invoked skill”。

参数：`$ARGUMENTS`
