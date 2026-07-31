---
description: 根据当前目标推荐最短工程流程，不执行或修改任何内容
---

# /ask-workflow - 工程流程导航

读取 `skills/using-superpowers/SKILL.md`，把 `$ARGUMENTS` 作为待路由目标。

只返回：

- 推荐入口与原因；
- 前置条件；
- 是否需要用户决策、Spec、tickets 或跨 session map；
- 是否需要通过 `handoff` Skill 进入全新 session 或隔离 prototype 分支；
- 后续闭环直到验证/审查的路径。

这是建议模式，不调用下一 skill、不写文件、不修改 tracker。
