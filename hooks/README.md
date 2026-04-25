# Hooks 脚本

此目录包含用于自动化的 Hook 脚本。

## 配置

当前 Hook 入口在仓库根目录 `settings.json` 中，脚本通过 `scripts/hooks/run-with-flags.js` 获得 profile 控制。
本目录只保存 Hook 脚本实现；若后续新增 `hooks.json`，需要同步更新 README 和根配置。

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
| `pre-compact.js` | 上下文压缩前保存信息 | PreCompact | `precompact:save-context` |
| `review-confidence.js` | 置信度审查报告 | 手动 | - |

## scripts/hooks/ 脚本

| 脚本 | 用途 | Hook 类型 | ID |
|------|------|-----------|----|
| `run-with-flags.js` | Hook 运行时控制器 | 基础设施 | - |
| `commit-quality.js` | Pre-commit 质量门 | PreToolUse | `pre:bash:commit-quality` |
| `session-start.js` | 会话启动上下文 | SessionStart | `session:start` |
| `session-end.js` | 会话结束持久化 | SessionEnd | `session:end` |

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
