---
name: e2e-testing
description: Use for explicit Playwright or E2E work; keep tests repeatable and load detailed patterns on demand.
origin: ECC
disable-model-invocation: true
---

# E2E Testing

只在用户明确要求 E2E、Playwright、端到端回归或测试不稳定性处理时加载。这里负责把需求落到项目已有的可重复测试入口；通用示例和配置细节见 `references/playwright-patterns.md`，命中具体问题时再读取。

## 先发现项目现状

1. 读取 `package.json`、lockfile、CI 配置和现有测试目录，确认包管理器与脚本。
2. 查找 `playwright.config.*`、`tests/e2e/`、`e2e/`、`BASE_URL`、启动命令和测试数据准备方式。
3. 优先使用项目已有依赖和 `npx playwright test`；缺少浏览器时再处理安装。
4. Agent Browser 或 MCP 只用于交互式探索和定位，不作为最终测试或报告来源。

## 执行契约

- 用 Page Object Model（POM）或项目已有等价抽象组织稳定定位器；优先 `getByRole`、`getByTestId` 和条件等待。
- 覆盖用户指定的关键旅程，并补正常、边界和错误路径；禁止用 `waitForTimeout` 掩盖竞态。
- 本地先运行与改动相关的最小集合；关键路径或新增测试重复运行以检查 flaky。
- 失败先读取 CLI 输出、trace、screenshot、video 和 HTML report，再判断是产品缺陷、测试缺陷还是环境问题。
- CI 失败保留 `playwright-report`、`test-results`、trace、screenshot 和 video；修复后至少复跑失败用例。

## 最小配置要求

项目没有现成 E2E 基础设施时，才新增最小 `playwright.config.*`、测试目录和脚本。配置应明确 `baseURL`、`webServer`、`trace: 'on-first-retry'`、`screenshot: 'only-on-failure'` 和失败制品保存策略。

## 输出

返回修改的测试或配置文件、实际运行命令、通过/失败结果、失败根因判断和可复查制品路径。未运行的检查说明原因，不把探索截图或受控 fixture 写成真实 E2E 通过。

## 参考

需要 POM、配置模板、flaky 隔离、重试和制品示例时，按需读取 `references/playwright-patterns.md`。
