# Superpowers Dev Loop Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Keep checkbox (`- [ ]`) status updated. For substantial plans, prefer the project-agent loop: one fresh implementation subagent per task, then requirement/spec compliance review, then code quality review.

**Goal:** Implement the approved Superpowers-style development loop gates across documentation, rules, skills, commands, and harness drift checks.

**Architecture:** The workflow is encoded as a layered harness contract: README for user discovery, `rules/01-base.md` for default agent behavior, skills for phase-specific gates, commands for verify/PR closure, and `scripts/verify-harness.js` for drift detection. The implementation keeps simple tasks lightweight while making complex work pass through spec, user review, plan, red test, review, verify, and PR gates.

**Tech Stack:** Markdown documentation, Node.js CommonJS validation script, existing repository commands and skills.

---

## File Structure

- Modify: `README.md`
  - Add a “Superpowers 风格开发闭环” section after the rule loading strategy or before the command table.
  - Keep the existing command list intact so `scripts/verify-harness.js` command discovery remains stable.
- Modify: `rules/01-base.md`
  - Extend the existing development flow with complex-task gates.
  - Preserve current tone and concise rule style.
- Modify: `skills/brainstorming/SKILL.md`
  - Clarify that approved spec is required before `writing-plans`.
  - Keep the existing hard gate and spec path.
- Modify: `skills/writing-plans/SKILL.md`
  - Add an explicit approved-spec precondition.
  - Keep Project-Agent Loop and Inline Execution handoff.
- Modify: `skills/test-driven-development/SKILL.md`
  - Add an explicit Red Test Gate section.
  - Keep current compact TDD discipline.
- Modify: `commands/verify.md`
  - Make `/verify` the Verify Gate and require run/skip/fail/risk reporting.
- Modify: `commands/pr.md`
  - Make `/pr` require a clear verify result before commit/PR.
- Modify: `scripts/verify-harness.js`
  - Fix rule-loading policy drift detection for the current AGENTS/CLAUDE wording.
  - Add a new `checkSuperpowersDevLoop()` drift check covering README, base rules, skills, commands, and spec existence.

---

## Task 1: Fix Current Harness Verification Drift

**Files:**
- Modify: `scripts/verify-harness.js`
- Test: `node scripts/verify-harness.js`

- [ ] **Step 1: Reproduce the current failure**

Run:

```bash
node scripts/verify-harness.js
```

Expected: FAIL with these messages:

```text
Harness verification failed:
- AGENTS.md should forbid loading all rules by default
- CLAUDE.md should forbid loading all rules by default
```

- [ ] **Step 2: Update the rule loading policy check**

In `scripts/verify-harness.js`, replace the strict single-string check:

```javascript
if (!body.includes("不要默认全量加载 `rules/`")) {
  fail(`${file} should forbid loading all rules by default`);
}
```

with wording-tolerant checks that accept the current project language:

```javascript
const forbidsFullRulesLoad =
  body.includes("不要默认全量加载 `rules/`") ||
  body.includes("不要默认全量加载`rules/`") ||
  body.includes("仍然只读取当前任务直接相关的规则文件");

const forbidsFullCommonLoad =
  body.includes("不要默认全量加载`rules/common/`") ||
  body.includes("不要默认全量加载 `rules/common/`") ||
  body.includes("`rules/common/` 是专项参考区");

if (!forbidsFullRulesLoad || !forbidsFullCommonLoad) {
  fail(`${file} should forbid loading all rules by default`);
}
```

- [ ] **Step 3: Run harness verification**

Run:

```bash
node scripts/verify-harness.js
```

Expected: PASS, unless a separate pre-existing harness issue appears. If another issue appears, record the exact issue in this plan before editing anything else.

- [ ] **Step 4: Commit**

Run:

```bash
git add scripts/verify-harness.js
git commit -m "fix: tolerate current rule loading wording"
```

Expected: commit succeeds and only `scripts/verify-harness.js` is included.

---

## Task 2: Document the Superpowers-Style Development Loop

**Files:**
- Modify: `README.md`
- Test: `node scripts/verify-harness.js`

- [ ] **Step 1: Add the loop section**

In `README.md`, add this section before `## 可用命令`:

````markdown
## Superpowers 风格开发闭环

复杂任务默认参考 [obra/superpowers](https://github.com/obra/superpowers) 的门禁结构，但不复制外部仓库文件。本仓的主线是：

```text
复杂任务
  -> brainstorming 澄清需求
  -> 写 design spec
  -> 用户审核 spec
  -> writing-plans 写实施计划
  -> 用户确认执行方式
  -> TDD 红绿重构
  -> 需求符合性审查
  -> 代码质量审查
  -> /verify 质量门
  -> /pr 提交/PR
  -> /learn-eval --preview 学习沉淀
```

硬门禁：

- 没有 spec，不进入 plan。
- 没有用户审核，不进入实现。
- 没有 failing test，不写行为代码。
- 没有 review，不标记任务完成。
- 没有 verify，不进入 PR。

复杂任务包括新功能、架构调整、多文件行为变化、高风险实现，以及需求存在多种合理解释的工作。简单问答、翻译、格式调整、窄范围文档修正和无行为变化的小修复，可以直接处理，但完成前仍需运行与改动范围匹配的最小验证。

收尾阶段按 `/verify` -> `/pr` -> `/learn-eval --preview` 推进。`/learn-eval --preview` 是非阻塞学习建议门，只在模式高频、稳定、可复用时保存。
````

- [ ] **Step 2: Check command list stability**

Run:

```bash
node scripts/verify-harness.js
```

Expected: PASS. If it fails because README command discovery changed, keep the existing `/command` table unchanged and adjust only the new section wording.

- [ ] **Step 3: Commit**

Run:

```bash
git add README.md
git commit -m "docs: document superpowers development loop"
```

Expected: commit succeeds and only `README.md` is included.

---

## Task 3: Encode the Gates in Base Rules

**Files:**
- Modify: `rules/01-base.md`
- Test: `node scripts/verify-harness.js`

- [ ] **Step 1: Replace the development flow block**

In `rules/01-base.md`, replace the current `## 开发流程` code block with:

```markdown
## 开发流程

简单任务走最小闭环：

```text
1. 理解需求 -> 阅读相关代码，理解现有架构
2. 增量实现 -> 只修改必要文件
3. 验证检查 -> 运行与改动范围匹配的最小验证
4. 总结结果 -> 明确已验证项、未验证项和剩余风险
```

复杂任务走 Superpowers 风格门禁闭环：

```text
1. Spec Gate -> brainstorming 澄清需求并写 design spec
2. User Review Gate -> 用户确认 spec 后才能继续
3. Plan Gate -> writing-plans 写实施计划
4. Red Test Gate -> 行为变化先写失败测试并确认失败原因
5. Task Review Gate -> 每个任务完成后做需求符合性审查和代码质量审查
6. Verify Gate -> /verify 或等价验证通过后才能进入 PR
7. PR Gate -> /pr 只处理本次任务相关文件并记录验证与风险
```

复杂任务包括新功能、架构调整、多文件行为变化、高风险实现，以及需求有多种合理解释的工作。
```
```

- [ ] **Step 2: Run harness verification**

Run:

```bash
node scripts/verify-harness.js
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```bash
git add rules/01-base.md
git commit -m "docs: add development loop gates to base rules"
```

Expected: commit succeeds and only `rules/01-base.md` is included.

---

## Task 4: Align Skills With Spec, Plan, and Red Test Gates

**Files:**
- Modify: `skills/brainstorming/SKILL.md`
- Modify: `skills/writing-plans/SKILL.md`
- Modify: `skills/test-driven-development/SKILL.md`
- Test: `node scripts/verify-harness.js`

- [ ] **Step 1: Update brainstorming skill gate wording**

In `skills/brainstorming/SKILL.md`, add this paragraph under `<HARD-GATE>` after the existing hard-gate sentences:

```markdown
For this repository, the written spec is the Spec Gate. Do not move to `writing-plans`, implementation, review, or PR work until the user has reviewed and approved the saved spec.
```

- [ ] **Step 2: Update writing-plans precondition**

In `skills/writing-plans/SKILL.md`, add this paragraph after the `## Overview` section:

```markdown
## Preconditions

Only write an implementation plan after a design spec exists and the user has approved it. If the request is complex and no approved spec exists, return to `skills/brainstorming/SKILL.md` instead of creating a plan. The approved spec is the Plan Gate input.
```

- [ ] **Step 3: Update TDD skill with Red Test Gate**

In `skills/test-driven-development/SKILL.md`, add this section after `## 核心规则`:

```markdown
## Red Test Gate

新功能、bug 修复、重构引起行为变化、公共 API 变化和用户流程变化，必须先写失败测试并运行确认失败原因正确，才能写行为实现代码。

如果当前任务确实没有可测试行为，先记录原因，并给出替代验证方式，例如脚本 smoke test、文档 diff 检查、人工验收步骤或 harness 验证命令。
```

- [ ] **Step 4: Run harness verification**

Run:

```bash
node scripts/verify-harness.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add skills/brainstorming/SKILL.md skills/writing-plans/SKILL.md skills/test-driven-development/SKILL.md
git commit -m "docs: align skills with development gates"
```

Expected: commit succeeds and only the three skill files are included.

---

## Task 5: Align Verify and PR Commands With Closing Gates

**Files:**
- Modify: `commands/verify.md`
- Modify: `commands/pr.md`
- Test: `node scripts/verify-harness.js`

- [ ] **Step 1: Add Verify Gate wording**

In `commands/verify.md`, add this paragraph after the title:

```markdown
`/verify` 是 Superpowers 风格闭环中的 Verify Gate。提交、推送或创建 PR 前，必须有明确验证结果：已运行检查、未运行检查及原因、失败项、剩余风险，以及是否可以进入 `/pr`。
```

- [ ] **Step 2: Add PR Gate wording**

In `commands/pr.md`, add this paragraph after the title:

```markdown
`/pr` 是 Superpowers 风格闭环中的 PR Gate。进入本命令前必须已有 `/verify` 或等价验证结果；如果验证失败或未运行关键检查，先回到验证和修复阶段，除非用户明确授权带风险继续。
```

- [ ] **Step 3: Strengthen PR pre-check**

In `commands/pr.md`, under `## 先检查`, add this item after the current item 4:

```markdown
5. 确认已有 `/verify` 或等价验证结果；若没有，先运行匹配改动范围的验证并记录结果。
```

- [ ] **Step 4: Run harness verification**

Run:

```bash
node scripts/verify-harness.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add commands/verify.md commands/pr.md
git commit -m "docs: align verify and pr gates"
```

Expected: commit succeeds and only the two command files are included.

---

## Task 6: Add Harness Drift Checks for the Development Loop

**Files:**
- Modify: `scripts/verify-harness.js`
- Test: `node scripts/verify-harness.js`

- [ ] **Step 1: Add helper function**

In `scripts/verify-harness.js`, add this function after `checkRuleLoadingPolicy()`:

```javascript
function requireTokens(file, tokens) {
  if (!exists(file)) {
    fail(`${file} is missing`);
    return;
  }

  const body = read(file);
  for (const token of tokens) {
    if (!body.includes(token)) {
      fail(`${file} should include ${token}`);
    }
  }
}
```

- [ ] **Step 2: Add Superpowers dev loop check**

Add this function after `requireTokens()`:

```javascript
function checkSuperpowersDevLoop() {
  requireTokens("README.md", [
    "Superpowers 风格开发闭环",
    "没有 spec，不进入 plan",
    "没有用户审核，不进入实现",
    "没有 failing test，不写行为代码",
    "没有 review，不标记任务完成",
    "没有 verify，不进入 PR",
    "`/learn-eval --preview` 是非阻塞学习建议门",
  ]);

  requireTokens("rules/01-base.md", [
    "Spec Gate",
    "User Review Gate",
    "Plan Gate",
    "Red Test Gate",
    "Task Review Gate",
    "Verify Gate",
    "PR Gate",
  ]);

  requireTokens("skills/brainstorming/SKILL.md", [
    "Spec Gate",
    "reviewed and approved the saved spec",
  ]);

  requireTokens("skills/writing-plans/SKILL.md", [
    "## Preconditions",
    "approved spec",
    "Plan Gate",
  ]);

  requireTokens("skills/test-driven-development/SKILL.md", [
    "## Red Test Gate",
    "失败测试",
    "替代验证",
  ]);

  requireTokens("commands/verify.md", [
    "Verify Gate",
    "已运行检查",
    "未运行检查",
    "是否可以进入 `/pr`",
  ]);

  requireTokens("commands/pr.md", [
    "PR Gate",
    "`/verify` 或等价验证结果",
    "先回到验证和修复阶段",
  ]);

  if (!exists("docs/superpowers/specs/2026-05-15-superpowers-dev-loop-design.md")) {
    fail("Superpowers dev loop design spec is missing");
  }
}
```

- [ ] **Step 3: Call the new check**

In `main()`, add `checkSuperpowersDevLoop();` after `checkRuleLoadingPolicy();`:

```javascript
checkRuleLoadingPolicy();
checkSuperpowersDevLoop();
checkForbiddenCommandDrift();
```

- [ ] **Step 4: Run harness verification**

Run:

```bash
node scripts/verify-harness.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add scripts/verify-harness.js
git commit -m "test: add development loop drift checks"
```

Expected: commit succeeds and only `scripts/verify-harness.js` is included.

---

## Task 7: Final Verification and Review

**Files:**
- Review: full diff since `main`
- Test: `node scripts/verify-harness.js`

- [ ] **Step 1: Run final harness verification**

Run:

```bash
node scripts/verify-harness.js
```

Expected:

```text
Harness verification passed.
```

- [ ] **Step 2: Run diff whitespace check**

Run:

```bash
git diff --check main...HEAD
```

Expected: no output and exit code 0.

- [ ] **Step 3: Review requirement coverage**

Check the implemented diff includes all first-phase acceptance criteria:

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Expected changed files include:

```text
README.md
rules/01-base.md
skills/brainstorming/SKILL.md
skills/writing-plans/SKILL.md
skills/test-driven-development/SKILL.md
commands/verify.md
commands/pr.md
scripts/verify-harness.js
docs/superpowers/specs/2026-05-15-superpowers-dev-loop-design.md
docs/superpowers/plans/2026-05-15-superpowers-dev-loop.md
```

- [ ] **Step 4: Commit the plan file if not already committed**

If the plan file remains uncommitted, run:

```bash
git add docs/superpowers/plans/2026-05-15-superpowers-dev-loop.md
git commit -m "docs: add superpowers dev loop implementation plan"
```

Expected: commit succeeds and only the plan file is included.

- [ ] **Step 5: Prepare PR summary**

Draft this PR summary for `/pr`:

```markdown
## 背景

参考 obra/superpowers 的开发闭环，将复杂任务的 spec、用户审核、plan、TDD、review、verify 和 PR 门禁固化到本仓 Harness。

## 核心改动

- 在 README 和基础规则中新增 Superpowers 风格开发闭环。
- 对齐 brainstorming、writing-plans、test-driven-development 的门禁职责。
- 明确 /verify 和 /pr 分别承担 Verify Gate 和 PR Gate。
- 修复规则加载检查的文案漂移，并新增开发闭环 drift check。

## 验证

- `node scripts/verify-harness.js`: PASS
- `git diff --check main...HEAD`: PASS

## 风险与回滚

风险较低，改动集中在文档和 Harness 验证脚本。若新 drift check 过严，可回滚 `scripts/verify-harness.js` 中 `checkSuperpowersDevLoop()` 的新增检查。
```

Expected: summary matches actual verification results.

---

## Self-Review

- Spec coverage: This plan covers README, base rules, brainstorming, writing-plans, TDD, verify, PR, learn-eval positioning, and harness drift checks from the approved spec.
- Placeholder scan: The plan contains no unresolved placeholder wording.
- Type consistency: Node script additions use existing CommonJS helpers and the repository's `exists()`, `read()`, and `fail()` functions.
- Scope check: Work remains Phase 1 only. Worktree isolation, new agents, strict hooks, and full subagent-driven-development are intentionally deferred.
