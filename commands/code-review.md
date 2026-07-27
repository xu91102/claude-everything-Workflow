---
description: 基于固定基点的双轴代码审查入口，委派 code-reviewer agent
---

# /code-review - 代码审查

这是 `agents/code-reviewer.md` 的 slash 入口。审查必须明确比较范围，并将
实现质量与需求符合性分开报告。

## 使用方式

```text
/code-review <base>
/code-review <base> --spec <path>
/code-review --staged
/code-review --staged --spec <path>
```

- `<base>` 是固定基点，例如 `main`、`origin/main`、提交 SHA 或 tag。
- 常规分支审查使用 `git diff <base>...HEAD`，确保比较的是共同祖先之后的改动。
- `--staged` 仅审查暂存区，使用 `git diff --cached`；它不是分支审查的替代基点。
- `--spec <path>` 指定需求、设计或计划文档；未指定时，审查者只可从提交引用和
  常见 Spec 目录中查找，找不到则将 Spec 轴标记为 `NOT RUN`。

未提供 `<base>` 且未使用 `--staged` 时，先询问用户比较基点；不要悄悄假定
`main` 或当前工作区中的任意文件。

## 执行规则

1. 优先委派 `code-reviewer` agent，并传入审查模式、固定基点、完整 diff、提交列表、
   审查范围与可用的 Spec 路径。
2. 审查者只读，不直接修改代码；缺少基点或 diff 时先报告 `BLOCKED`。
3. 报告分为互不混合的 Standards 轴与 Spec 轴：前者检查仓库规则和代码质量，后者检查
   改动是否实现已知需求。
4. 每个轴内部按严重性排序，并列出证据位置、风险和测试缺口；不要用一个总分掩盖另一轴
   的失败。
5. 如果无法委派 agent，主模型按同一协议执行只读审查。

## 参数

`$ARGUMENTS`
