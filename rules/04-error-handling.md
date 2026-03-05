# 错误处理 (CRITICAL)

## 基本原则

| 原则               | 说明                             |
| ------------------ | -------------------------------- |
| **NEVER 忽略错误** | 捕获的错误必须处理或重新抛出     |
| 使用具体异常       | 避免捕获顶级 Exception/Error     |
| 提供上下文         | 错误信息包含足够排查信息         |
| 区分类型           | 业务错误 vs 系统错误 vs 校验错误 |
| 统一处理           | 使用全局错误处理机制             |

## 错误处理模式

```
1. 早返回：校验失败尽早返回，避免深层嵌套
2. 错误边界：在模块边界处统一处理错误
3. 错误转换：跨层调用时转换为本层的错误类型
4. 日志记录：错误必须记录，包含上下文信息
```

## API 错误处理分层 (CRITICAL)

### 业务代码禁止 try/catch

**原则**：

- 让拦截器统一处理 HTTP 错误
- 保持业务代码简洁

**正确示例**：

```typescript
// CORRECT: 让拦截器统一处理
async function getUser(id: string) {
  return await api.get(`/users/${id}`);
}
```

**错误示例**：

```typescript
// WRONG: 业务代码不应处理 HTTP 错误
async function getUser(id: string) {
  try {
    return await api.get(`/users/${id}`);
  } catch (error) {
    message.error("获取失败");
  }
}
```

**特殊场景例外**：

- 需要降级处理（失败后使用默认值）
- 需要特殊错误提示
- 批量操作部分失败继续执行

## 异步错误处理

ALWAYS 确保：

- 异步操作使用 try-catch 包裹
- Promise 必须处理 catch
- NEVER 吞掉异步错误
