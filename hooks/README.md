# Hooks 脚本

此目录包含用于自动化的 Hook 脚本。

## 脚本列表

| 脚本 | 用途 | Hook 类型 |
|------|------|-----------|
| `check-console-log.js` | 检测 console.log | PostToolUse |
| `review-confidence.js` | 置信度审查报告 | 手动 |
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

### review-confidence.js

生成直觉置信度审查报告，帮助用户识别需要关注的直觉。
不自动修改任何文件的置信度值，所有变更由用户决策驱动。

**用法:**

```bash
# 生成审查报告
node ~/.claude/hooks/review-confidence.js

# 自定义过期天数（默认 30 天）
node ~/.claude/hooks/review-confidence.js --stale 60

# JSON 格式输出
node ~/.claude/hooks/review-confidence.js --json
```

**报告分类:**

| 状态 | 含义 | 建议操作 |
|------|------|----------|
| 活跃 | 近期有观察证据 | 保持现状 |
| 待审查 | 超过阈值天数未观察 | 人工确认是否仍适用 |
| 低证据 | 置信度低且缺乏证据 | 在实践中验证后决定 |

**配置:**

审查参数在 `skills/continuous-learning-v2/config.json` 中配置：

```json
{
  "instincts": {
    "stale_threshold_days": 30,
    "review_mode": "report"
  }
}
```
