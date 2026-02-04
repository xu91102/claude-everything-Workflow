# Hooks 脚本

此目录包含用于自动化的 Hook 脚本。

## 脚本列表

| 脚本 | 用途 | Hook 类型 |
|------|------|-----------|
| `check-console-log.js` | 检测 console.log | PostToolUse |
| `decay-confidence.js` | 置信度衰减检查 | 手动/定时 |
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

### decay-confidence.js

实现直觉置信度衰减机制，每周无观察降低 0.02 置信度。

**用法:**

```bash
# 预览变更
node ~/.claude/hooks/decay-confidence.js --dry-run

# 执行衰减
node ~/.claude/hooks/decay-confidence.js
```

**配置:**

衰减参数在 `skills/continuous-learning-v2/config.json` 中配置：

```json
{
  "instincts": {
    "confidence_decay_rate": 0.02,
    "min_confidence": 0.3
  }
}
```

**直觉文件格式:**

```yaml
---
id: pattern-name
confidence: 0.7
lastObserved: "2026-01-15"    # 最后观察日期
lastDecayCheck: "2026-02-05"  # 最后衰减检查日期
---
```

