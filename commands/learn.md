---
description: 统一管理学习模式的评估、状态、项目、推广、清理与演化
---

# /learn - Continuous Learning 管理入口

用一个稳定入口管理 Continuous Learning。`$ARGUMENTS` 的第一个位置参数必须是子命令；
缺少或无法识别子命令时，只显示帮助，不猜测、不执行写操作。
整体模型与安全边界以 `skills/continuous-learning-v2/SKILL.md` 为准。

## 使用方式

```text
/learn eval [--preview]
/learn status [--domain <name>] [--high] [--review] [--scope project|global|legacy]
/learn projects [--json] [--register-current]
/learn promote [--project-id <id>] [--min-confidence <value>] [--dry-run|--apply]
/learn prune [--reviewed-only] [--dry-run]
/learn evolve [--domain <name>] [--apply]
```

## 子命令路由

| 子命令 | 作用 | 默认写入 |
| --- | --- | --- |
| `eval` | 从当前会话提取并评估可复用模式 | 否；保存前确认 |
| `status` | 查看置信度、证据和待审查状态 | 否 |
| `projects` | 查看 Continuous Learning 项目注册表 | 否 |
| `promote` | 预览 project instinct 到 global instinct 的推广 | 否 |
| `prune` | 清理人工明确标记删除、拒绝或归档的 instinct | 否 |
| `evolve` | 评估模式是否应演化为 skill、agent 或 command | 否 |

## `/learn eval`

从当前会话提取错误解决模式、调试技巧、变通方案和项目特定模式。默认完成质量门后展示
建议；`--preview` 只评估，不保存。

1. 提取一个具体、可复用的模式。
2. 递归检查 `skills/learn/` 是否已有重复或可吸收目标。
3. 选择 `skills/learn/<category>/<pattern-name>.md`；禁止保存到 `skills/learn/` 根目录。
4. 把 observations、project instincts、global instincts 和 legacy homunculus 只作为候选证据；
   保存后的权威学习产物必须位于 `skills/learn/<category>/`。
5. 给出 `Save / Improve / Absorb / Drop` 判决。
6. `Save` 或 `Absorb` 必须展示路径与内容或 diff，并在用户确认后写入。

不保存琐碎修复、一次性故障、重复内容或无法形成触发条件的抽象建议。

## `/learn status`

显示 project/global/legacy instincts 的数量、置信度、证据数量、最后观察时间和待审查状态。

- 置信度不会因时间流逝自动衰减。
- 长期无观察只标记待审查，不自动删除。
- `--review` 调用 `scripts/learning/review-confidence.js`；报告只标记待审查，不修改置信度。
- 此子命令不删除文件。

## `/learn projects`

调用 `scripts/learning/projects.js`。

- 默认只读显示项目 ID、名称、路径和最近观察时间。
- `--json` 输出机器可读格式。
- `--register-current` 注册当前项目，但不创建 instinct。

## `/learn promote`

调用 `scripts/learning/promote.js`。

- 默认等同 `--dry-run`，只展示达到阈值的 project instinct；默认阈值为 `0.7`。
- 已存在的 global instinct 不覆盖。
- `--apply` 写入前必须展示候选结果并获得用户确认。

## `/learn prune`

扫描 project/global/legacy instincts，只选择满足以下任一人工标记的文件：

- `delete: true`
- `status: rejected`
- `status: archived`
- `review_decision: delete`

`keep: true`、`status: active`、`review_decision: keep` 或仅长期无观察的内容必须保留。
默认先展示待删除列表和保留原因；`--dry-run` 只预览，真正删除前必须取得用户确认。
置信度和时间不能单独作为删除依据，也不得执行自动衰减。

## `/learn evolve`

优先读取 `skills/learn/<category>/` 中已确认的模式，instinct 和 observations 只作为候选证据来源。

1. 聚类相似触发条件、动作和证据。
2. 优先评估为自动触发的 `skill`，其次是需要隔离上下文的 `agent`。
3. 只有用户会明确主动触发且 Skill/Agent 无法表达时，才建议新增 `command`。
4. 输出候选类型、理由、证据、风险、回滚方式和预计 token 影响。
5. 默认只生成建议；`--apply` 必须先展示将修改的文件并获得用户确认。

跨项目复用价值明确时，先使用 `/learn promote --dry-run`；legacy 内容演化前先通过
`/learn eval` 或人工确认沉淀到 `skills/learn/<category>/`。
