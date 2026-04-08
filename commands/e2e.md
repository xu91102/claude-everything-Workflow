---
description: Playwright / E2E — 委派 e2e-testing 技能；复杂场景可 spawn e2e-runner 代理
---

# /e2e — 端到端测试

为关键用户路径编写、维护或运行 E2E 测试（Playwright；可选 Agent Browser）。

## 权威内容

- 模式与示例：优先阅读并遵循 `skills/e2e-testing/SKILL.md`。
- 执行与探索：可委派 **`e2e-runner`** 代理生成/运行测试、处理 flake 与制品。

## 使用方式

```
/e2e                     # 按当前需求补充或运行 E2E
/e2e 登录流程            # 聚焦指定用户旅程
```

## 委派要点

1. 应用 **`e2e-testing`** 技能：POM、`data-testid`、`playwright.config`、CI、制品与 flake 策略。
2. 默认只跑**与本次改动相关**的 spec；用户明确要求全量时再跑整个套件。
3. 失败时收集 **HTML report / trace / screenshot** 路径并给出可操作的修复建议。
4. 需要多轮浏览器操作或从零搭建 E2E 骨架时，使用 **`e2e-runner`** 代理执行。

## 参数

`$ARGUMENTS` — 用户描述的目标流程、文件路径或环境（如 `BASE_URL`）。
