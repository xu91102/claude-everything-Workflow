---
description: 导入他人分享的直觉
---

# /instinct-import - 导入直觉

导入他人分享的直觉，学习团队或社区的最佳实践。

## 使用方式

```
/instinct-import ./team-instincts.json
/instinct-import https://example.com/instincts.json
/instinct-import --preview ./instincts.json  # 预览不导入
```

## 导入流程

1. **预览** - 显示将导入的直觉列表
2. **确认** - 用户确认导入
3. **合并** - 与现有直觉合并（不覆盖）
4. **调整置信度** - 导入的直觉初始置信度降低 0.1

## 导入规则

| 情况 | 行为 |
|------|------|
| 新直觉 | 直接添加，置信度 -0.1 |
| 相同 ID | 不覆盖，提示冲突 |
| 相似直觉 | 提示可能重复 |

## 置信度调整

导入的直觉置信度 = 原置信度 × 0.8

理由：未经你自己验证的模式，应该低于自己学习的模式。

## 预览输出

```
导入预览
==================

来源: team-instincts.json
直觉数量: 8

将导入:
1. [code-style] prefer-functional-style (0.56 → 0.45)
2. [testing] always-test-first (0.72 → 0.58)
3. [workflow] grep-before-edit (0.64 → 0.51)

冲突 (将跳过):
- prefer-functional-style 已存在

确认导入? (y/n)
```

## 保存位置

导入的直觉保存到 `~/.claude/homunculus/instincts/inherited/`

与个人直觉 (`personal/`) 分开存放。

## 相关命令

- `/instinct-export` - 导出直觉
- `/instinct-status` - 查看学习状态
