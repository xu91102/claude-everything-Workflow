---
description: 从已确认需求生成、自审并请求批准正式工程 Spec
---

# /to-spec - 正式工程 Spec Gate

读取并执行 `skills/spec-gate/SKILL.md`，把 `$ARGUMENTS` 和当前会话中已确认的 grilling
handoff 作为输入。Spec 自审并经用户批准后，按项目上下文配置选择本地 tracker 或经确认
发布到外部 tracker。

该命令不复制 Spec schema、预检或审批协议；`skills/spec-gate/SKILL.md` 是唯一事实来源。
