---
name: large-work-planning
description: 为单会话无法容纳的巨大或模糊工作建立 decision-ticket 地图，逐张消除 fog of war，直到抵达已命名的 Spec、决策或原地变更目标。
disable-model-invocation: true
---

# Large Work Planning

只用于路径尚不可见、超过一个 agent session 的工作。Destination 可以是待交付的 Spec、
需锁定的决策，或 change-in-place（例如数据结构迁移）。

默认只规划：ticket 解决 decisions，路径清晰时交给适合该 Destination 的下一流程。只有 map
的 `Notes` 经用户明确批准携带 execution 时，才允许在地图内执行通往 change-in-place 的工作；
不得从“目标很大”自行推断该 override。

## When to Use

目标跨多个 session 且从当前状态到 Destination 的决策路径仍不可见时使用；路径已清晰则不用。

## How It Works

### Model

一个 map 记录 Destination、Notes、Decisions so far、尚无法精确表述的 **fog of war**
（Not yet specified）和 Out of scope。

`Notes` 还记录每个 session 应加载的能力、长期偏好，以及是否显式允许 execution。没有该
override 时，任何“直接做掉”的冲动都表示已经到达地图边缘，应停止并 hand off。

每张 **decision ticket** 只解决一个 100K-token session 可容纳的问题，并标为：

- `research`（AFK）：第一方资料或外部事实；
- `prototype`（HITL）：需要可运行或可视产物；
- `grilling`（HITL）：默认的用户决策；
- `task`（AFK/HITL）：只为解锁后续决策的前置动作。

Tracker 原生 blocking 建立依赖；不支持时才在正文记录。**frontier** 是 open、所有 blocker
complete 且 unclaimed 的 tickets。Claim 必须在工作前以 tracker assignee 或本地 persisted
状态完成。

## Chart the Map

1. 联合 `grilling` 与 `domain-modeling` 定义 Destination。
2. breadth-first 探索第一层精确问题和 fog；若路径已能在一会话内说清，建议常规流程并停止。
3. 经用户确认后创建 map，再创建当前可精确描述的 tickets，第二遍连接 blocking edges。
4. 无法准确表述的问题留在 fog，不预先切票。
5. 可并发启动 research tickets；其他类型不代替人类完成 HITL。
6. 停止。Chart session 不手动解决决策。

## Work Through the Map

每个 session 最多解决 **one ticket**（并发 research 例外）：

1. 重载 map 和 persisted tracker 状态；用户未指定时领取第一个 frontier ticket。
2. 先 claim，再按 ticket 类型调用对应能力。
3. 把答案作为 resolution 记录，关闭 ticket，并给 map 增加一行 context pointer。
4. 将新变清晰的 fog 创建为 tickets 后从 fog 删除；新 ticket 先创建、后连边。
5. 发现越界内容时关闭对应票并写入 Out of scope，不记入 Decisions so far。
6. 处理并发变更后重新计算 frontier；冲突时返回 `BLOCKED`，不重复领取。

直到 frontier 与 fog 都为空且路径清晰：

- Destination 是 Spec：交给 `spec-gate`；
- Destination 是决策：返回已锁定决定与证据；
- Destination 是 change-in-place：默认交给正式交付流程；仅当 `Notes` 已显式允许
  execution 时，按票内批准范围完成变更并保留验证证据。

## Example

“规划一个全新支付平台，但供应商、账本和迁移路径都未知”先明确 Destination 是 Spec、关键
决策还是获批的原地迁移，再建立决策地图。

## Exit

返回 `MAP_CREATED`、`ONE_DECISION_RESOLVED`、`READY_FOR_SPEC`、`DECISION_LOCKED`、
`DESTINATION_REACHED` 或 `BLOCKED`。只有 `Notes` 显式允许 execution 的 change-in-place
地图可以在 `DESTINATION_REACHED` 中包含已实现与验证证据。
