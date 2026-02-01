# 错误处理 (CRITICAL)

## 基本原则

| 原则 | 说明 |
|------|------|
| **NEVER 忽略错误** | 捕获的错误必须处理或重新抛出 |
| 使用具体异常 | 避免捕获顶级 Exception/Error |
| 提供上下文 | 错误信息包含足够排查信息 |
| 区分类型 | 业务错误 vs 系统错误 vs 校验错误 |
| 统一处理 | 使用全局错误处理机制 |

## 错误处理模式

```
1. 早返回：校验失败尽早返回，避免深层嵌套
2. 错误边界：在模块边界处统一处理错误
3. 错误转换：跨层调用时转换为本层的错误类型
4. 日志记录：错误必须记录，包含上下文信息
```

## 正确示例

```typescript
// CORRECT: 完整的错误处理
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await api.get(`/users/${id}`)
    return response.data
  } catch (error) {
    console.error('获取用户失败:', { id, error })
    throw new UserFetchError(`无法获取用户 ${id}`, { cause: error })
  }
}
```

## 错误示例

```typescript
// WRONG: 忽略错误
try {
  await dangerousOperation()
} catch (e) {
  // 空的 catch 块！
}
```

## 异步错误处理

ALWAYS 确保：
- 异步操作使用 try-catch 包裹
- Promise 必须处理 catch
- NEVER 吞掉异步错误
