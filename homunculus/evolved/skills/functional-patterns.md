---
name: functional-patterns
description: 强制函数式编程模式
confidence: 0.78
evolved_from:
  - prefer-functional-style
  - use-immutable-data
  - avoid-side-effects
---

# 函数式模式技能

由 3 个相关 instincts 演化而来的技能。

## 核心原则

1. **纯函数** - 相同输入始终产生相同输出
2. **不可变数据** - 不修改原始数据
3. **避免副作用** - 函数不改变外部状态

## 模式

### 映射而非循环

```typescript
// PREFER
const doubled = numbers.map(n => n * 2)

// AVOID
const doubled = []
for (const n of numbers) {
  doubled.push(n * 2)
}
```

### 不可变更新

```typescript
// PREFER
const updated = { ...user, name: 'New Name' }

// AVOID
user.name = 'New Name'
```

## 触发条件

- 编写新函数时
- 处理数组/对象时
- 状态更新时
