# Hooks 系统最佳实践

## Hook 类型

| 类型 | 触发时机 | 用途 |
|------|---------|------|
| PreToolUse | 工具执行前 | 验证、参数修改、阻止 |
| PostToolUse | 工具执行后 | 自动格式化、质量检查 |
| Stop | 会话结束时 | 最终验证、状态持久化 |

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
export ECC_DISABLED_HOOKS="pre:bash:commit-quality,post:edit:console-log"
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
