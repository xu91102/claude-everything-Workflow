---
name: test-driven-development
description: "Use for new behavior assertions or explicit test-first work; reuse existing regressions."
---

# Test-Driven Development

参考：[superpowers](https://github.com/obra/superpowers/tree/main/skills/test-driven-development)、
[mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd)。

## 何时使用

需要新增或修改行为断言，或用户明确要求测试先行时使用。已有准确复现目标问题的失败回归可直接复用。
没有可测试行为的文档、格式或配置整理直接验证；缺少测试入口不代表没有可测行为。
生成代码验证生成入口；原型按用户要求验证探索行为。

## Public Seam

测试和调用方应穿过同一个 seam，优先最高层且稳定的公共接口，不依赖私有状态。
正式 Spec/ticket 记录关键 seam；直接任务沿用明确接口，不额外制造用户问题。
若选择会改变公共契约、架构或测试成本，返回中央路由解决用户决策。

## Red Test Gate

先复用或新增一个最小失败测试，运行并确认命中目标问题。期望来自需求、固定事实或独立预期，
不用被改算法给自己打分。依赖、加载、语法等非目标错误不算有效 RED。
确无可测试行为时记录原因与替代验证；预期 RED 留在实现循环，根因不明或重复异常才进入调试。

## RED → GREEN → REFACTOR

每轮推进一个可观察行为的垂直切片（tracer bullet）：

1. RED：用明确断言确认所缺行为；测试名称说明预期结果。
2. GREEN：只实现使当前测试通过的最小改动，运行相关测试。
3. REFACTOR：绿色后整理代码并保持绿色；发现新行为缺口时回到 RED。

每轮可独立运行和回退，不预写尚未需要的测试，不顺手扩展需求或做无关重构。
mock 限于第三方 API、时间、随机性等真实系统边界；优先真实测试设施，不 mock 自有内部模块、调用次数或实现顺序。

## 完成

每个新增行为有对应失败证据和实现后的通过证据；受影响边界与错误路径有相称覆盖。
按项目验证合同复用或补齐最终状态证据，如实报告失败及未运行项。
