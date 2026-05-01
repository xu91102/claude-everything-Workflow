---
description: 清理人工标记为删除或已拒绝的直觉
---

# /prune - 清理待删除直觉

清理已经被人工标记为删除、拒绝或归档的直觉文件。
长期无观察只进入待审查，不因时间自动删除。

## 使用方式

```text
/prune
/prune --reviewed-only
/prune --dry-run
```

## 清理规则

删除条件满足任一项:

- `delete: true`
- `status: rejected`
- `status: archived`
- `review_decision: delete`

保留条件满足任一项:

- `keep: true`
- `status: active`
- `review_decision: keep`
- 只是长期无观察，但没有明确删除、拒绝或归档标记

## 执行流程

1. 扫描 `homunculus/instincts/personal/` 和 `homunculus/instincts/inherited/`。
2. 解析 frontmatter，筛选明确标记为可删除的直觉。
3. 展示待删除列表和保留原因摘要。
4. `--dry-run` 只预览，不删除。
5. 真正删除前必须向用户确认。

## 注意

- 置信度和时间不能单独作为删除依据。
- 长期无观察先用 `/instinct-status --review` 标记待审查。
- 此命令不能执行自动衰减。
