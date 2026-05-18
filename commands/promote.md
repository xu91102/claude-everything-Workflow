---
description: 预览或推广项目级直觉到全局直觉
---

# /promote - 项目直觉推广

把当前项目中高置信、可跨项目复用的直觉推广到 global instinct。默认只预览，不写文件。

## 使用方式

```text
/promote --dry-run
/promote --project-id <id> --dry-run
/promote --min-confidence 0.8 --dry-run
/promote --apply
```

## 执行规则

调用 `scripts/learning/promote.js`。

- 默认等同 `--dry-run`，只显示候选。
- `--apply` 写入前必须展示候选结果并获得用户确认。
- 已存在的 global instinct 不覆盖。
- 只推广置信度达到阈值的 project instinct，默认阈值为 `0.7`。

## 参数

`$ARGUMENTS`
