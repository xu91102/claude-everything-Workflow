# Hooks 脚本

此目录包含用于自动化的 Hook 脚本。

## 脚本列表

| 脚本 | 用途 | Hook 类型 |
|------|------|-----------|
| `check-console-log.js` | 检测 console.log | PostToolUse |
| `evaluate-session.js` | 会话结束评估 | Stop |
| `observe.js` | 观察工具调用 | PreToolUse/PostToolUse |

## 配置方式

在 `settings.json` 中配置：

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "tool == \"Edit\"",
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/hooks/check-console-log.js"
      }]
    }],
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/hooks/evaluate-session.js"
      }]
    }]
  }
}
```

## 脚本说明

### check-console-log.js

在代码编辑后检测文件中是否存在 `console.log`，发现时输出警告。

### evaluate-session.js

会话结束时评估是否有可提取的模式，提醒用户使用 `/learn` 命令。

### observe.js

观察每次工具调用，记录到 `~/.claude/homunculus/observations.jsonl`，供持续学习系统分析。
