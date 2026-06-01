---
description: 从当前会话中提取模式，经质量门评估后保存
---

# /learn-eval - 提取、评估、保存

从当前会话中提取可复用模式，在保存前增加**质量门评估**，避免保存低质量、重复的模式。

## 使用方式

```
/learn-eval              # 分析当前会话，评估后保存
/learn-eval --preview    # 仅评估，不保存
```

## 提取对象

1. **错误解决模式** - 根因 + 修复 + 可复用性
2. **调试技巧** - 非显而易见的步骤、工具组合
3. **变通方案** - 库/API 的变通方法、版本特定修复
4. **项目特定模式** - 约定、架构决策、集成模式

## 流程

### 1. 提取模式
分析会话中最有价值的可复用洞察。

### 2. 确定保存位置与分类
- **全局** (`~/.claude/skills/learn/<category>/` 或 `~/.codex/skills/learn/<category>/`): 跨项目可复用的通用模式
- **项目** (`.claude/skills/learn/<category>/` 或项目约定的等价目录): 项目特定的知识
- 拿不准时选全局（全局迁移到项目比反向更容易）
- 必须选择一个分类子目录，禁止直接保存到 `skills/learn/` 根目录。
- 常用分类: `pr`、`testing`、`debugging`、`docs`、`frontend`、`backend`、`devops`、`architecture`、`workflow`、`tools`、`project`、`general`。
- 文件路径格式: `skills/learn/<category>/<pattern-name>.md`，例如 `skills/learn/pr/auto-pr-confirmation.md`。
- `homunculus`、project instincts、global instincts 和 `observations.jsonl` 只能作为候选来源；保存后的权威学习产物必须落在 `skills/learn/<category>/`。

### 3. 草拟技能文件

```markdown
---
name: pattern-name
description: "130 字符以内描述"
origin: auto-extracted
---

# [描述性名称]

**提取日期:** [日期]
**上下文:** [何时适用]

## 问题
[具体解决什么问题]

## 解决方案
[模式/技巧/方案 - 含代码示例]

## 触发条件
[何时激活]
```

### 4. 质量门检查

执行以下检查清单:

- [ ] 递归 grep `skills/learn/` 检查关键词重叠
- [ ] 确认是可复用模式而非一次性修复
- [ ] 检查是否应合并到已有技能中
- [ ] 验证描述具体且可操作
- [ ] 确认已选择合适分类，且不会保存到 `skills/learn/` 根目录

### 5. 判决

| 判决 | 含义 | 操作 |
|------|------|------|
| **Save** | 独特、具体、范围合理 | 保存文件 |
| **Improve** | 有价值但需打磨 | 修改后重新评估 |
| **Absorb** | 应合并到已有技能 | 追加到目标文件 |
| **Drop** | 琐碎、重复或太抽象 | 说明原因，不保存 |

### 6. 确认后保存

- **Save**: 展示路径 + 内容 -> 用户确认后保存
- **Absorb**: 展示目标路径 + diff -> 用户确认后追加
- **Drop**: 只展示原因

## 注意事项

- 不提取琐碎修复（拼写错误、简单语法问题）
- 不提取一次性问题（特定 API 故障等）
- 聚焦能在未来会话中节省时间的模式
- 一个技能文件只包含一个模式
