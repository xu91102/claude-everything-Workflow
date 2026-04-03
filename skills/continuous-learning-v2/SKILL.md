---
name: continuous-learning-v2
description: 基于直觉的学习系统，通过 Hooks 观察会话，创建带置信度的原子直觉，并演化为 skills/commands/agents。
version: 2.0.0
---

# Continuous Learning v2 - 直觉架构

将 Claude Code 会话转化为可复用知识的高级学习系统，通过原子级"直觉"实现，带有置信度评分。

## v2 新特性

| 特性 | v1 | v2 |
|---------|----|-------|
| 观察方式 | Stop hook | PreToolUse/PostToolUse (100% 可靠) |
| 分析方式 | 主上下文 | 后台 Agent (Haiku) |
| 粒度 | 完整技能 | 原子级"直觉" |
| 置信度 | 无 | 0.3-0.9 加权 |
| 演化 | 直接变技能 | 直觉 → 聚类 → skill/command/agent |
| 分享 | 无 | 导出/导入直觉 |

## 直觉模型

直觉是一个小型学习行为：

```yaml
---
id: prefer-functional-style
trigger: "编写新函数时"
confidence: 0.7
domain: "code-style"
source: "session-observation"
---

# 优先函数式风格

## 行为
适当时使用函数式模式代替类。

## 证据
- 观察到 5 次函数式模式偏好
- 用户在 2026-01-15 将类方法改为函数式
```

**属性:**
- **原子性** — 一个触发器，一个行为
- **置信度加权** — 0.3 = 试探性, 0.9 = 接近确定
- **领域标签** — code-style, testing, git, debugging, workflow 等
- **证据支持** — 追踪什么观察创建了它

## 工作流程

```
会话活动
      │
      │ Hooks 捕获提示 + 工具使用 (100% 可靠)
      ▼
┌─────────────────────────────────────────┐
│         observations.jsonl              │
│   (提示, 工具调用, 结果)                 │
└─────────────────────────────────────────┘
      │
      │ Observer Agent 读取 (后台, Haiku)
      ▼
┌─────────────────────────────────────────┐
│          模式检测                        │
│   • 用户纠正 → 直觉                      │
│   • 错误解决 → 直觉                      │
│   • 重复工作流 → 直觉                    │
└─────────────────────────────────────────┘
      │
      │ 创建/更新
      ▼
┌─────────────────────────────────────────┐
│         instincts/personal/             │
│   • prefer-functional.md (0.7)          │
│   • always-test-first.md (0.9)          │
│   • use-zod-validation.md (0.6)         │
└─────────────────────────────────────────┘
      │
      │ /evolve 聚类
      ▼
┌─────────────────────────────────────────┐
│              evolved/                   │
│   • commands/new-feature.md             │
│   • skills/testing-workflow.md          │
│   • agents/refactor-specialist.md       │
└─────────────────────────────────────────┘
```

## 快速开始

### 1. 启用观察 Hooks

添加到 `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/hooks/observe.js pre"
      }]
    }],
    "PostToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/hooks/observe.js post"
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

### 2. 可用命令

| 命令 | 功能 |
|------|------|
| `/learn` | 手动分析当前会话 |
| `/instinct-status` | 查看所有直觉及其置信度 |
| `/evolve` | 将相关直觉聚类为 skills/commands/agents |
| `/instinct-export` | 导出直觉分享 |
| `/instinct-import` | 导入他人直觉 |

### 3. 置信度系统

| 分数 | 含义 | AI 行为 |
|------|------|---------|
| 0.3 | 试探性 | 建议但不强制 |
| 0.5 | 中等 | 相关时提及 |
| 0.7 | 强 | 主动应用 |
| 0.9 | 核心 | 始终应用 |

**置信度计算:**
- 1-2 观察: 0.3
- 3-5 观察: 0.5
- 6-10 观察: 0.7
- 11+ 观察: 0.85

**动态调整:**
- +0.05: 每次确认观察
- -0.10: 每次矛盾观察
- 定期审查: 使用 `review-confidence.js` 生成报告，由用户决定是否调整

> 注意: 置信度不会因时间流逝自动衰减。所有变更由证据和用户决策驱动。

## 相关命令

- `/learn` - 手动提取模式
- `/evolve` - 聚类演化
- `/instinct-status` - 查看学习状态
- `/instinct-export` - 导出直觉
- `/instinct-import` - 导入直觉
