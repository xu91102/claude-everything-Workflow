---
description: 查看 Continuous Learning 项目注册表
---

# /projects - 学习项目状态

查看 Continuous Learning v2 的项目注册表，确认项目级学习数据来自哪里。

## 使用方式

```text
/projects
/projects --json
/projects --register-current
```

## 执行规则

调用 `scripts/learning/projects.js`。

- 默认只读显示项目 ID、名称、路径和最近观察时间。
- `--register-current` 注册当前项目，但不创建 instinct。
- `--json` 输出机器可读格式。

## 参数

`$ARGUMENTS`
