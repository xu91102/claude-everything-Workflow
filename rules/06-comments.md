# 注释规范

## 必须注释的场景

| 场景 | 说明 |
|------|------|
| 复杂业务逻辑 | 解释业务规则和计算逻辑 |
| 非常规实现 | hack、workaround 需说明原因 |
| 公共 API | 导出的函数、类、组件需文档注释 |
| 重要配置 | 解释配置项的作用和取值范围 |
| 正则表达式 | 解释匹配规则 |
| 算法实现 | 说明算法思路和复杂度 |
| 魔法数字 | 解释数字含义或抽为常量 |

## 注释格式

### 公共 API（使用文档注释）

```typescript
/**
 * 计算订单总价
 * @param items - 订单商品列表
 * @param discount - 折扣比例 (0-1)
 * @returns 计算后的总价
 */
function calculateTotal(items: Item[], discount: number): number
```

### 内部逻辑（解释"为什么"）

```typescript
// 使用 setTimeout 0 确保 DOM 更新后执行
setTimeout(() => {
  scrollToBottom()
}, 0)
```

## 禁止的注释

```typescript
// WRONG: 解释"做什么"（代码应自解释）
// 遍历数组
for (const item of items) { ... }
```
