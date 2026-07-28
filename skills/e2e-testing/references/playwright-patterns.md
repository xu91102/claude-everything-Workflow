# Playwright Patterns

只在核心 E2E 流程需要配置、组织或 CI 细节时读取本页。

## 推荐布局

```text
tests/
  e2e/<journey>/*.spec.ts
  fixtures/
  pages/
playwright.config.ts
```

Page Object 只封装重复 selector 与领域动作，不隐藏断言、测试数据或关键等待。

## 配置基线

- `forbidOnly: !!process.env.CI`
- 本地默认不 retry；CI 只使用有上限的 retry。
- `trace: "on-first-retry"`
- `screenshot: "only-on-failure"`
- `video: "retain-on-failure"`
- `reuseExistingServer: !process.env.CI`
- browser matrix 按兼容风险选择，不默认全开。

## CI 制品

无论测试成功或失败，都保留 HTML report。失败时额外上传 trace、截图和视频，并设置有限
retention。敏感页面、token、账户或响应体不得进入公开制品。

## 高风险旅程

支付、交易、钱包、权限和生产副作用必须使用隔离环境或受控 boundary double。无法证明不会
触发真实副作用时返回 `BLOCKED`，不执行该旅程。
