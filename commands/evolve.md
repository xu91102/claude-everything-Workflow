---
description: 将相关模式聚类为技能、命令或代理
---

# /evolve - 演化模式

分析学习到的模式，将相关模式聚类为高级结构。

## 使用方式

```
/evolve                    # 分析所有模式
/evolve --domain testing   # 只演化测试领域
/evolve --dry-run          # 预览不创建
```

## 演化规则

### → Command（用户调用）
当模式描述用户会显式请求的操作时

### → Skill（自动触发）
当模式描述应该自动发生的行为时

### → Agent（复杂任务）
当模式描述复杂的多步骤过程时

## 流程

1. 读取 `skills/learned/` 中的所有模式
2. 按领域和触发模式分组
3. 对于 3+ 相关模式的聚类：
   - 确定演化类型
   - 生成相应文件
   - 保存到 `homunculus/evolved/`

## 输出格式

```
演化分析
==================

发现 2 个可演化的聚类：

## 聚类 1: 调试流程
模式: debug-check-logs, debug-isolate
类型: Agent
置信度: 72%

将创建: debugger 代理

---
运行 /evolve --execute 创建文件。
```
