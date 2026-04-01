---
id: prefer-functional-style
trigger: "编写新函数时"
confidence: 0.7
domain: "code-style"
source: "session-observation"
lastObserved: "2026-01-15"
---

# 优先使用函数式风格

## 行为

适当时使用函数式模式代替类。

## 证据

- 观察到 5 次函数式模式偏好
- 用户在 2026-01-15 将类方法改为纯函数

## 示例

```typescript
// PREFER: 纯函数
const calculateTotal = (items: Item[]) => 
  items.reduce((sum, item) => sum + item.price, 0)

// AVOID: 类方法
class Calculator {
  calculateTotal(items: Item[]) { ... }
}
```
