# 为项目建立可复用验收能力

CEW 提供两个通用技能，让项目保留自己的运行与操作方式，再由 [feature-acceptance](../skills/feature-acceptance/SKILL.md) 调用。浏览器、桌面、CLI、服务或库沿用各自真实用户入口，按实际可用工具生成步骤。

## 第一次创建

在目标项目中提出：

> 为这个项目创建可复用的验收技能。先复用已有测试和操作工具，建立功能地图，跑通一个真实用户流程，并保留清理后仍可读取的证据。

这会使用 [create-verification-skill](../skills/create-verification-skill/SKILL.md)。它检查实际启动、环境、隔离与宿主约定，将技能写入项目已有目录；没有约定时按宿主选择项目级目录。已有工具够用就直接复用，有缺口时只补最小操作工具。

生成结果包括：

- `SKILL.md`：启动、健康检查、操作、观察、证据和清理。
- `features/README.md` 与功能文件：用户目标、入口、操作、断言和前置条件。
- 必要的 helper：项目已有语言编写，具有帮助、明确退出码与真实调用示例。

先覆盖实际存在的 3–5 项功能，执行一个功能证明工具可用。地图中的其他功能仍未验证；没有环境或账号时结果为 `BLOCKED`，不能把草稿当作验收通过。

## 后续维护与验收

> 维护这个项目的验收技能和功能地图。核对源码，并执行每个功能的真实流程；修正工具漂移，单独报告产品问题。

[maintain-verification-skill](../skills/maintain-verification-skill/SKILL.md) 检查全部已映射功能。默认串行使用应用，修正自己的说明和工具；产品回归保留失败断言与证据，按另外的修复授权处理。

> 验收刚才改动的真实用户流程，使用项目已有验收技能，给我可复核的结果。

`feature-acceptance` 先从项目指令、已登记技能或现有操作入口定位对应能力，只读本轮相关功能文件，再执行和审核证据。缺少专用技能时仍可按已有项目命令验收，不会自动扩建整套工具。

三个技能都可通过自然语言使用；只在命中任务后加载正文，不新增每次会话默认加载的功能地图。提交、外部写入和自动运行仍依用户授权及项目流程。

## 如何判断效果

结果统一使用 `PASS / FAIL / BLOCKED / NOT RUN`，报告实际入口、代码版本、操作、断言、证据及清理结果。CLI/API 的实际输出可作日志证据；界面功能需要真实页面或应用证据。

先在一个项目试点，记录相同任务的真实流程通过率、人工复核时间、返工与回滚、执行时间及成本，再决定扩展并行度。技能结构检查或单次工具生成不证明工程产能；这套能力没有承诺 PR 数量。

## 来源与许可

项目验收生成和维护流程改编自 [Lauren Tan 的 pstack](https://github.com/cursor/plugins/tree/d0ef80d86795816da932a153458c5dbe192d294e/pstack)，固定参考版本 `d0ef80d86795816da932a153458c5dbe192d294e`：

- [create-verification-skill](https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/create-verification-skill/SKILL.md)
- [maintain-verification-skill](https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/maintain-verification-skill/SKILL.md)

CEW 调整了宿主目录、自然语言触发、修改授权与证据协议，保留上游 [MIT 许可与版权声明](../references/pstack-license.txt)。本次分发的是通用工作流；各项目具体工具需在项目内生成并实际运行证明。
