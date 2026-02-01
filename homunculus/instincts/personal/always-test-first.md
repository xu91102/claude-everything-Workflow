---
id: always-test-first
trigger: "实现新功能时"
confidence: 0.9
domain: "testing"
source: "session-observation"
---

# 始终先写测试

## 行为

实现功能前先编写测试用例。

## 证据

- 多次观察到 TDD 模式
- 置信度已从 0.7 提升到 0.9

## 步骤

1. 定义接口
2. 编写失败测试
3. 运行测试确认失败
4. 实现最少代码
5. 运行测试确认通过
6. 重构
