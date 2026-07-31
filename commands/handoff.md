---
description: 将当前工作压缩成临时目录中的脱敏交接文档，供全新 session 继续
---

# /handoff - 跨 session 交接

读取并执行 `skills/handoff/SKILL.md`。把 `$ARGUMENTS` 作为下一 session 的工作重点。

仅在临时目录创建一个 Markdown 文件；不修改仓库或 tracker。返回精确路径后停止当前流程，
由用户在全新 session 中引用该文件继续。
