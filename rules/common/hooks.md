# Hooks 系统最佳实践

## Hook 类型

| 类型 | 触发时机 | 用途 |
|------|---------|------|
| PreToolUse | 工具执行前 | 验证、参数修改、阻止 |
| PostToolUse | 工具执行后 | 自动格式化、质量检查 |
| Stop | 会话结束时 | 最终验证、状态持久化 |
| PreCompact | 上下文压缩前 | 保存关键信息 |

## 摘要类 Hook 规范

- 只有恢复价值高于上下文噪音时才启用 `PreCompact` / `SessionEnd` 摘要类 Hook；默认模板不启用 `SessionStart`、`SessionEnd`、`Stop` 或 `PreCompact` 中只写弱状态、占位统计或提示语的 Hook。
- 摘要字段和内容边界以 `rules/common/context-hygiene.md` 为唯一来源；Hook 不按轮数机械总结，也不写回完整 transcript。
- 输出短、结构化、可恢复，默认写入持久化文件；stderr 只给必要提示，stdout 保持静默。摘要不得覆盖用户规则、计划或决策；冲突留待人工确认，敏感内容只记录风险和证据位置。

## 退出码约定

| 退出码 | 含义 |
|--------|------|
| 0 | 成功（继续执行），stderr 内容作为警告 |
| 2 | 阻止工具调用（仅 PreToolUse） |
| 其他非零 | 错误（记录但不阻止） |

## Hook Profile 控制

通过环境变量控制 Hook：`ECC_HOOK_PROFILE` 可选 `minimal`、`standard`（默认）或 `strict`；`ECC_DISABLED_HOOKS` 用逗号分隔需禁用的 Hook ID。

| Profile | 说明 |
|---------|------|
| minimal | 仅保留必要的生命周期和安全 Hook |
| standard | 默认，平衡质量和安全检查 |
| strict | 启用额外提醒和更严格的护栏 |

## 编写自定义 Hook

自定义 Hook 通过 stdin 接收 JSON；警告写 stderr，仅确实需要修改协议输出时写 stdout，阻止语义遵循上表。

## 权限管理

- 仅为受信任、定义明确的计划启用自动接受；探索性工作禁用。
- 不使用 `dangerously-skip-permissions`，在 `~/.claude.json` 配置 `allowedTools`。
- 会阻止提交的质量门 Hook 默认不启用，只有团队明确需要时再接入。
