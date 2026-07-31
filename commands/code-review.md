---
description: 基于固定基点启动相互隔离的 Standards 与 Spec 并行审查
---

# /code-review - 代码审查

这是 `agents/code-reviewer.md` 的 slash 入口。审查必须明确比较范围，并将
实现质量与需求符合性放入两个相互隔离的并行 sub-agent，最后分轴聚合。

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

1. 先解析固定基点并固定唯一 diff 命令与提交列表；基点无效或 diff 为空时返回 `BLOCKED`。
2. 找出仓库规则与 Spec 来源。找不到 Spec 时只跳过 Spec sub-agent，并把该轴标为 `NOT RUN`。
3. 在同一轮并行启动两个 fresh、只读且上下文隔离的 sub-agent：
   - `standards-reviewer`：只接收固定 diff、提交列表、规则来源与 smell baseline；
   - `spec-reviewer`：只接收同一固定 diff、提交列表与 Spec，不接收 Standards 结论。
4. 两个 sub-agent 都不得修改代码。主调用者等待两者结束后，在 `Standards` 与 `Spec`
   标题下分别呈现报告；只能轻度清理格式，不能跨轴合并、重排或选出单一赢家。
5. 运行时没有并行 sub-agent 能力时返回 `BLOCKED_BY_PARALLEL_REVIEW_UNAVAILABLE`；
   不得退化成一个上下文中的顺序双轴审查。

Standards 轴除仓库规则外，始终以 Fowler smell baseline 检查 Mysterious Name、
Duplicated Code、Feature Envy、Data Clumps、Primitive Obsession、Repeated Switches、
Shotgun Surgery、Divergent Change、Speculative Generality、Message Chains、Middle Man
与 Refused Bequest；仓库明确规则优先，工具已强制的事项不重复报告。

## 参数

`$ARGUMENTS`
