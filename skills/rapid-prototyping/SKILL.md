---
name: rapid-prototyping
description: 用明确标记为 throwaway 的可运行原型回答一个逻辑、状态或 UI 设计问题。
---

# Rapid Prototyping

原型是回答一个问题的 **throwaway** code，不是生产实现。

## When to Use

状态/logic 无法仅靠文字判断，或 UI 必须看到多个方案才能决策时使用。

## How It Works

### Choose the Shape

- “这个 state model / logic 是否成立？”：做小型交互式 terminal app。
- “这个 UI 应该长什么样？”：在临时 route 提供多个明显不同、可切换的 variations。
- 无法判断且用户不可达时，按周边代码选择并在原型顶部声明假设。

## Rules

1. 放在真实使用位置附近，但名称必须含 `prototype`，避免误认为生产代码。
2. 提供 **one command** 启动；遵循仓库现有 runtime/router，不引入新脚手架。
3. 默认只用内存；涉及持久化时使用明确可清理的 scratch 数据。
4. 省略生产级 abstractions、tests 和 polish，只实现可运行反馈。
5. 每次动作或 variation 切换都展示完整相关 state。
6. 给用户试用并记录 question、verdict、证据与未解决项。
7. 将结论带回正式设计；原型留在 throwaway branch 或删除，不合入生产 mainline。

原型本身不证明生产实现正确，也不替代正式 Spec、TDD 或 acceptance。

## Example

“用终端原型验证订单取消状态机是否自然”只实现可交互状态迁移并展示每次完整 state。

## Exit

返回 `PROTOTYPE_READY`、`QUESTION_ANSWERED` 或 `BLOCKED_BY_AMBIGUOUS_QUESTION`，附运行命令和 verdict。
