---
name: find-skills
description: 在本仓库与已配置的宿主能力中发现适合当前任务的 skill，并给出可验证的本地使用或安装路径。
---

# Find Skills

这是仓库内的 **self-contained** fallback；不能假设宿主预装同名系统 skill。

## Workflow

1. 从用户目标提炼能力关键词、输入格式和期望产物。
2. 优先检索本仓库 `skills/*/SKILL.md` 的 `name` 与 `description`：

   ```bash
   rg -n "^(name|description):" skills/*/SKILL.md
   ```

3. 若本地没有匹配，使用当前宿主公开的 skill/plugin 工具；工具不可用时，直接通过可用 Web、
   GitHub CLI/API 或公开 registry 搜索外部 agent-skill ecosystem，不依赖同名宿主 skill。
4. 读取候选 `SKILL.md` 全文，核对触发条件、依赖、写操作与 invocation mode。
5. 返回最少候选集：名称、匹配原因、来源、如何调用，以及缺失依赖。

## Installation Safety

- 用户只要求查找时，不安装、不修改配置。
- 用户明确要求安装后，才调用可用安装器或给出项目内复制方案。
- 外部候选必须标注来源与固定版本；安装后重新发现并验证。
- 本仓库已有等价能力时，优先复用，避免重名和重复维护。

## Example

“找一个能生成 PDF 的 skill，但先不要安装”返回本地候选和可验证外部候选，不执行写入。

## Exit

返回 `LOCAL_MATCH`、`EXTERNAL_CANDIDATES`、`NO_VERIFIED_MATCH` 或
`NEEDS_INSTALL_AUTHORIZATION`。
