# 项目 Agent 上下文

> 本文件定义本仓库中 Agent 应读取和更新的长期项目上下文；不要记录密钥、访问令牌或临时会话信息。

## 工作追踪

- 提供方：`<github | jira | linear | local-markdown | custom>`
- 位置：`<仓库、项目键、URL 或本地路径>`
- 允许工具：`<gh | jira CLI | linear connector | 无>`
- 使用规则：`<何时读取、何时创建或更新；没有授权时仅只读>`
- 依赖关系：`<原生 blocking/sub-issue 能力，或正文 Blocked by 约定>`
- 本地工件目录：`<local-markdown 路径；非本地 tracker 填不适用>`

### Tracker 操作

- 读取：`<查看单项、评论、标签和依赖关系的命令/工具>`
- 查询：`<列出待分诊、frontier 或 ready-for-agent 项的命令/工具>`
- 创建：`<创建 Issue/ticket 的命令/工具；执行前必须确认>`
- 更新：`<评论、标签、依赖、claim、close 的命令/工具；执行前必须确认>`

## 分诊角色

| Category 规范角色 | Tracker 标签 |
| --- | --- |
| `bug` | `<label>` |
| `enhancement` | `<label>` |

| State 规范角色 | Tracker 标签 |
| --- | --- |
| `needs-triage` | `<label>` |
| `needs-info` | `<label>` |
| `ready-for-agent` | `<label>` |
| `ready-for-human` | `<label>` |
| `wontfix` | `<label>` |

外部 PR 是否作为请求入口：`<yes | no>`

## Wayfinder / Tickets

- Map：`<位置或 tracker 对象形状>`
- Child ticket：`<位置或 sub-issue 关系>`
- Blocking：`<原生依赖或 Blocked by 约定>`
- Frontier：`<open + unblocked + unclaimed 的查询方式>`
- Claim / Progress / Resolve：`<状态、assignee、进度记录、关闭及解锁查询操作>`

## 领域文档

- 布局：`<single-context | multi-context>`
- 上下文入口：`<CONTEXT.md 或 CONTEXT-MAP.md>`
- ADR 目录：`<现有路径、建议路径，或尚未创建>`
- 消费规则：实现前读取相关领域词汇；术语或长期决策改变时使用 `domain-modeling`；没有已批准内容时不创建空文档。

## 已确认约束

- `<仅记录已由用户或现有项目文档确认的约束>`

## 更新规则

- 工作追踪的外部写操作始终需要用户授权和可用连接器。
- `CONTEXT.md` 只保存稳定领域词汇，不保存实现草稿。
- ADR 只记录难以回滚、缺少背景会令人意外、且经过真实权衡的决策。
