---
description: 导出直觉以便分享
---

# /instinct-export - 导出直觉

导出你学习到的直觉，用于分享给团队或备份。

## 使用方式

```
/instinct-export                    # 导出所有直觉
/instinct-export --domain testing   # 只导出测试领域
/instinct-export --min-confidence 0.7  # 只导出高置信度
/instinct-export --output ./my-instincts.json
```

## 导出格式

```json
{
  "version": "2.0",
  "exported_at": "2026-02-01T10:00:00Z",
  "instincts": [
    {
      "id": "prefer-functional-style",
      "trigger": "编写新函数时",
      "action": "优先使用函数式模式",
      "confidence": 0.7,
      "domain": "code-style",
      "evidence_count": 5
    }
  ],
  "metadata": {
    "total_count": 15,
    "avg_confidence": 0.65,
    "domains": ["code-style", "testing", "workflow"]
  }
}
```

## 导出流程

1. 读取 `~/.claude/homunculus/instincts/personal/`
2. 过滤符合条件的直觉
3. 移除隐私信息（具体文件路径、代码片段）
4. 生成可分享的 JSON 文件

## 隐私保护

导出时自动移除：
- 具体文件路径
- 代码片段
- 会话 ID
- 时间戳详情

保留：
- 模式名称
- 触发条件
- 行为描述
- 置信度
- 领域分类

## 相关命令

- `/instinct-import` - 导入他人直觉
- `/instinct-status` - 查看学习状态
