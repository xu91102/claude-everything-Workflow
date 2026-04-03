# 错误处理 (CRITICAL)

**基本原则**：NEVER 忽略错误 | 使用具体异常 | 提供上下文 | 区分类型 | 统一处理

**处理模式**：早返回 | 错误边界 | 错误转换 | 日志记录

**API 错误处理**：业务代码禁止 try/catch，让拦截器统一处理 HTTP 错误

```typescript
// CORRECT
async function getUser(id: string) {
  return await api.get(`/users/${id}`);
}

// WRONG
async function getUser(id: string) {
  try {
    return await api.get(`/users/${id}`);
  } catch (error) {
    message.error("获取失败");
  }
}
```

**例外场景**：降级处理 | 特殊错误提示 | 批量操作部分失败

**异步错误**：ALWAYS 使用 try-catch 包裹，Promise 必须处理 catch，NEVER 吞掉错误
