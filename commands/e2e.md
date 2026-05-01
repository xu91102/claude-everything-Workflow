---
description: E2E 入口，薄封装委派 e2e-runner agent 和 e2e-testing skill
---

# /e2e - 端到端测试

这是 E2E 测试入口，不重复维护 Playwright/Agent Browser 细节。
E2E 方法以 `skills/e2e-testing/SKILL.md` 为准。

## 使用方式

```text
/e2e
/e2e 登录流程
/e2e checkout
```

## 执行规则

1. 优先应用 `e2e-testing` skill 的测试约定。
2. 需要编写、维护或运行 E2E 时委派 `e2e-runner` agent。
3. 默认只处理用户指定或本次改动相关的关键路径。
4. 失败时返回 HTML report、trace、screenshot 等可复查产物路径。
5. 如果无法委派 agent，主模型只做最小相关 E2E 诊断和建议。

## 参数

`$ARGUMENTS`
