---
description: TDD 入口，薄封装委派 tdd-guide agent
---

# /tdd - 测试驱动开发

这是 `agents/tdd-guide.md` 的 slash 入口，不重复维护 TDD 流程细节。
TDD 方法以 `skills/test-driven-development/SKILL.md` 为准。

## 使用方式

```text
/tdd 用户登录功能
/tdd 修复订单状态边界条件
```

## 执行规则

1. 优先委派 `tdd-guide` agent。
2. 传入目标功能、已有测试位置、相关文件和约束。
3. 默认先定义行为和失败测试，再做最小实现建议。
4. 只运行或建议运行与本次目标相关的测试。
5. 如果无法委派 agent，主模型按 RED/GREEN/REFACTOR 顺序执行。

## 参数

`$ARGUMENTS`
