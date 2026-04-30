---
description: 测试驱动开发工作流
---

# /tdd - 测试驱动开发

使用 TDD 方法实现功能。

## TDD 循环

```
RED → GREEN → REFACTOR → REPEAT

RED:      编写失败的测试
GREEN:    编写最少的代码使测试通过
REFACTOR: 改进代码，保持测试通过
```

## 使用方式

```
/tdd 用户登录功能          # 使用 TDD 实现
/tdd --coverage 80%       # 要求 80% 覆盖率
```

## 流程

### Step 1: 定义接口

```typescript
export interface LoginService {
  login(email: string, password: string): Promise<User>
}
```

### Step 2: 编写测试 (RED)

```typescript
describe('LoginService', () => {
  it('should return user on valid credentials', async () => {
    const user = await loginService.login('test@example.com', 'password')
    expect(user.email).toBe('test@example.com')
  })

  it('should throw on invalid credentials', async () => {
    await expect(
      loginService.login('test@example.com', 'wrong')
    ).rejects.toThrow('Invalid credentials')
  })
})
```

### Step 3: 运行测试 (验证失败)

```bash
npm test -- --grep "LoginService"
```

### Step 4: 实现代码 (GREEN)

实现最少的代码使测试通过。

### Step 5: 重构

改进代码质量，保持测试通过。

### Step 6: 检查覆盖率

```bash
npm test -- --coverage
```

## 覆盖率目标

| 类型 | 最低要求 |
|------|----------|
| 语句 | 80% |
| 分支 | 75% |
| 函数 | 80% |
| 行 | 80% |
