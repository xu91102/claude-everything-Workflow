# Hooks 脚本

此目录包含用于自动化的 Hook 脚本。

## 配置

统一 Hook 配置在 `hooks.json` 中，每个 Hook 有唯一 ID 和描述。
旧版 `settings.json` 保持向后兼容。

### Hook Profile 控制

```bash
export ECC_HOOK_PROFILE=standard       # minimal | standard | strict
export ECC_DISABLED_HOOKS="hook-id"    # 逗号分隔禁用列表
```

## 本目录脚本

| 脚本 | 用途 | Hook 类型 | ID |
|------|------|-----------|----|
| `observe.js` | 观察工具调用 | PreToolUse/PostToolUse | `pre:observe` / `post:observe` |
| `check-console-log.js` | 检测 console.log | PostToolUse | `post:edit:console-log` |
| `evaluate-session.js` | 会话结束评估 | Stop | `stop:evaluate-session` |
| `review-confidence.js` | 置信度审查报告 | 手动 | - |

## scripts/hooks/ 脚本

| 脚本 | 用途 | Hook 类型 | ID |
|------|------|-----------|----|
| `run-with-flags.js` | Hook 运行时控制器 | 基础设施 | - |
| `commit-quality.js` | Pre-commit 质量门 | PreToolUse | `pre:bash:commit-quality` |
| `session-start.js` | 会话启动上下文 | SessionStart | `session:start` |
| `session-end.js` | 会话结束持久化 | Stop | `stop:session-end` |

## review-confidence.js

生成直觉置信度审查报告，不自动修改任何文件的置信度值。

```bash
node hooks/review-confidence.js              # 审查报告
node hooks/review-confidence.js --stale 60   # 自定义过期天数
node hooks/review-confidence.js --json       # JSON 格式
```

| 状态 | 含义 | 建议 |
|------|------|------|
| 活跃 | 近期有观察证据 | 保持现状 |
| 待审查 | 超过阈值天数未观察 | 人工确认 |
| 低证据 | 置信度低且缺乏证据 | 验证后决定 |

## 编写自定义 Hook

参考 `rules/common/hooks.md` 获取 Hook 编写指南和 stdin/stdout 协议说明。
支持 `module.exports = { run }` 导出方式以获得性能优化（由 run-with-flags.js 直接 require）。
