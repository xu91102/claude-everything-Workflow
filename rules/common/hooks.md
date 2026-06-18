# Hooks 系统最佳实践

## Hook 类型

| 类型 | 触发时机 | 用途 |
|------|---------|------|
| PreToolUse | 工具执行前 | 验证、参数修改、阻止 |
| PostToolUse | 工具执行后 | 自动格式化、质量检查 |
| Stop | 会话结束时 | 最终验证、状态持久化 |
| PreCompact | 上下文压缩前 | 保存关键信息 |

## 摘要类 Hook 规范

- 只有在能产生明确恢复价值时，才启用 `PreCompact` / `SessionEnd` 摘要类 Hook；不要保留只写弱状态、占位统计或提示语的生命周期 Hook。
- 摘要目标是恢复工作现场，不是提高模型智力；只记录目标、决策、关键文件、待办、验证结果、风险和未决问题。
- 不机械总结“前 N 轮对话”，也不把完整 transcript 写回上下文；轮数不是有效信息密度的可靠指标。
- Hook 输出应短、结构化、可恢复；默认写入持久化文件，stderr 只给必要提示，stdout 保持静默，避免污染协议输出。
- 默认模板不启用会话启动、会话结束、停止或压缩前的弱摘要 Hook；这类 Hook 必须先证明恢复价值高于上下文噪音成本。
- 自动摘要不得覆盖用户明确写下的规则、计划或决策；发现冲突时记录冲突并要求后续人工确认。
- 涉及敏感信息、凭据、外部链接 token 或用户私密内容时，默认只记录存在风险和证据位置，不保存原文。

## 退出码约定

| 退出码 | 含义 |
|--------|------|
| 0 | 成功（继续执行），stderr 内容作为警告 |
| 2 | 阻止工具调用（仅 PreToolUse） |
| 其他非零 | 错误（记录但不阻止） |

## Hook Profile 控制

通过环境变量控制 Hook 行为:

```bash
# minimal | standard | strict (默认: standard)
export ECC_HOOK_PROFILE=standard

# 禁用特定 Hook (逗号分隔 ID)
export ECC_DISABLED_HOOKS="post:edit:console-log"
```

| Profile | 说明 |
|---------|------|
| minimal | 仅保留必要的生命周期和安全 Hook |
| standard | 默认，平衡质量和安全检查 |
| strict | 启用额外提醒和更严格的护栏 |

## 编写自定义 Hook

```javascript
// my-hook.js - 通过 stdin 接收 JSON，默认保持 stdout 静默
let data = ''
process.stdin.on('data', chunk => data += chunk)
process.stdin.on('end', () => {
    const input = JSON.parse(data)

    // 警告 (非阻塞): 写到 stderr
    console.error('[Hook] 警告信息')

    // 阻止 (仅 PreToolUse): 以退出码 2 退出
    // process.exit(2)

    // 仅在确实需要修改 hook 协议输出时写 stdout
})
```

## TodoWrite 最佳实践

使用 TodoWrite 工具:
- 追踪多步骤任务进度
- 验证对指令的理解
- 启用实时转向
- 展示细粒度实施步骤

Todo 列表可以揭示:
- 步骤顺序错误
- 遗漏项
- 不必要的额外项
- 粒度不对
- 需求理解偏差

## 权限管理

- 为受信任的、定义明确的计划启用自动接受
- 探索性工作时禁用
- 不使用 `dangerously-skip-permissions` 标志
- 在 `~/.claude.json` 中配置 `allowedTools`
- 会阻止提交的质量门 Hook 默认不启用；只有团队明确需要时再接入
