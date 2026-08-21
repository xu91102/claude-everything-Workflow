# 测试与验证政策

- 项目已有脚本和 CI 是命令、覆盖率阈值与质量门的权威来源；先读取 package、workspace、构建配置和测试先例，不硬编码包管理器或通用百分比。
- 中间步骤运行能证明当前切片的最小检查；跨模块、发布、PR、高风险或失败修复完成时，按影响面升级验证范围。
- 无法运行项目规定的检查时，说明原因、替代证据和剩余风险；不能静默跳过或伪装通过。
- 行为变化的 RED/GREEN/REFACTOR 协议由 `skills/test-driven-development/SKILL.md` 所有。
- Playwright、POM、trace、截图、CI 制品和 flaky 策略由 `skills/e2e-testing/SKILL.md` 所有。
- 完成声明所需的新鲜证据由 `skills/verification-before-completion/SKILL.md` 所有；本规则不复制执行流程。
