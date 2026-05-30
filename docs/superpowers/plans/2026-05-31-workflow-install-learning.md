# Workflow Install And Learning Path Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Keep checkbox (`- [ ]`) status updated. For substantial plans, prefer the project-agent loop: one fresh implementation subagent per task, then requirement/spec compliance review, then code quality review.

**Goal:** Make the Workflow install/runtime documentation, learning path policy, and harness verification match `docs/superpowers/specs/2026-05-31-workflow-install-learning-design.md`.

**Architecture:** Keep runtime behavior layered: Claude Code owns `settings.json` hook activation, while Claude and Codex share the same workflow materials. Strengthen `scripts/verify-harness.js` with focused checks for README tree drift, install script parity, hook references, and `skills/learn/<category>/` policy.

**Tech Stack:** Markdown, Node.js CommonJS, PowerShell, Bash.

---

## Current Worktree Notes

- Preserve existing uncommitted `verification-before-completion` changes in `README.md`, `skills/writing-plans/SKILL.md`, `skills/executing-plans/SKILL.md`, `scripts/verify-harness.js`, and `skills/verification-before-completion/SKILL.md`.
- Do not touch the unrelated untracked `.claude/` directory.
- Do not commit unless the user explicitly asks.

## File Structure

- Modify `README.md`: correct install/runtime language, remove nonexistent directory tree entries, clarify learning path authority.
- Modify `commands/evolve.md`: state that instincts and observations are candidate sources, while `skills/learn/<category>/` is the learned-pattern source.
- Modify `commands/learn-eval.md`: keep `skills/learn/<category>/` as the save target and clarify Codex/Claude user-level wording.
- Modify `rules/common/skills-learning.md`: reinforce the final learning artifact path and candidate-source distinction.
- Modify `scripts/verify-harness.js`: add deterministic checks for README tree paths, install parity, hook config references, and learning path rules.
- Create `skills/learn/pr/.gitkeep`, `skills/learn/testing/.gitkeep`, and `skills/learn/debugging/.gitkeep`.

### Task 1: Add Learning Directory Placeholders

**Files:**
- Create: `skills/learn/pr/.gitkeep`
- Create: `skills/learn/testing/.gitkeep`
- Create: `skills/learn/debugging/.gitkeep`

- [x] **Step 1: Create category directories and placeholder files**

Use empty `.gitkeep` files so Git preserves the required learning categories:

```text
skills/learn/pr/.gitkeep
skills/learn/testing/.gitkeep
skills/learn/debugging/.gitkeep
```

- [x] **Step 2: Verify files exist**

Run:

```powershell
Test-Path skills\learn\pr\.gitkeep
Test-Path skills\learn\testing\.gitkeep
Test-Path skills\learn\debugging\.gitkeep
```

Expected:

```text
True
True
True
```

- [x] **Step 3: Inspect diff**

Run:

```powershell
git status --short
```

Expected: the three `.gitkeep` files are untracked or added, and `.claude/` remains unrelated.

### Task 2: Align README Runtime And Directory Documentation

**Files:**
- Modify: `README.md`

- [x] **Step 1: Update install target wording**

Replace the install target paragraph:

```markdown
安装目标：

- Claude Code: `~/.claude/`
- Codex: `~/.codex/`

顶层配置文件已存在且内容不同时，会先生成 `.bak.<timestamp>` 备份再覆盖；目录内容按仓库版本同步。
```

With:

```markdown
安装目标：

- Claude Code: `~/.claude/`
- Codex: `~/.codex/`

Claude Code 会安装 `CLAUDE.md` 并合并 `settings.json` 作为 hooks 入口；Codex 安装共享 Workflow 材料，不默认消费 Claude Code `settings.json`。顶层配置文件已存在且内容不同时，会先生成 `.bak.<timestamp>` 备份再覆盖；目录内容按仓库版本同步。
```

- [x] **Step 2: Correct `settings.json` directory tree description**

Replace:

```markdown
├── settings.json               # 旧版 Hooks 配置 (向后兼容)
```

With:

```markdown
├── settings.json               # Claude Code Hooks 配置入口
```

- [x] **Step 3: Remove nonexistent `hooks/README.md` from tree**

Delete this line from the hooks tree:

```markdown
│   ├── README.md               # Hook 文档
```

- [x] **Step 4: Keep `skills/learn/` in the tree after Task 1 creates it**

Keep this block, because Task 1 creates the directories:

```markdown
│   └── learn/                  # 学习到的模式，按分类保存
│       ├── pr/
│       ├── testing/
│       └── debugging/
```

- [x] **Step 5: Clarify Hook Profile runtime scope**

After this sentence:

```markdown
当前仓库以根目录 `settings.json` 作为 Claude Code hooks 入口；`hooks/` 目录统一保存 Hook 运行时和脚本实现。`scripts/learning/` 只保存手动学习治理脚本，不作为 Hook 自动触发。
```

Add:

```markdown
Codex 安装同一套 `hooks/` 脚本材料，但不会因为安装本仓文件而自动启用 Claude Code hooks；如未来需要 Codex 原生自动化，应新增明确 adapter。
```

- [x] **Step 6: Update Continuous Learning v2 workflow text**

Replace the current workflow diagram:

```text
会话活动 → Hooks 观察 → projects/<project-id>/observations.jsonl
                            ↓
                     Observer Agent (Haiku)
                            ↓
               projects/<project-id>/instincts/
                  ↓                    ↓
       /promote 预览推广      /prune 清理
                  ↓
        global/instincts 或 evolved/skills/commands/agents/
```

With:

```text
会话活动 → Hooks 观察 → projects/<project-id>/observations.jsonl
                            ↓
                     Observer Agent (Haiku)
                            ↓
               projects/<project-id>/instincts/
                  ↓                    ↓
       /learn-eval 质量门      /promote 预览推广
                  ↓                    ↓
        skills/learn/<category>/   global/instincts
                  ↓
        /evolve 评估是否升级为正式 skills/commands/agents
```

- [x] **Step 7: Add learning path authority paragraph**

After the data-root paragraph, add:

```markdown
`observations.jsonl`、project instincts 和 global instincts 是观察、候选和迁移来源；经 `/learn-eval` 质量门确认后，最终学习产物以 `skills/learn/<category>/` 为权威路径。只有高频、稳定、可组合的模式才通过 `/evolve` 升级为正式 `skills/`、`commands/` 或 `agents/`。
```

- [x] **Step 8: Update usage flow**

Replace:

```text
10. 使用 /learn-eval 积累模式
```

With:

```text
10. 使用 /learn-eval 将稳定模式沉淀到 skills/learn/<category>/
```

- [x] **Step 9: Verify README references**

Run:

```powershell
Select-String -Path README.md -Pattern 'hooks/README|Claude Code hooks|skills/learn/<category>|settings.json|Codex'
```

Expected:

- No `hooks/README` match.
- `settings.json` is described as Claude Code hook config.
- Codex is described as sharing workflow materials without automatic Claude Code hook activation.
- `skills/learn/<category>/` appears as the final learning artifact path.

### Task 3: Align Learning Commands And Rules

**Files:**
- Modify: `commands/evolve.md`
- Modify: `commands/learn-eval.md`
- Modify: `rules/common/skills-learning.md`

- [x] **Step 1: Update `/evolve` input language**

In `commands/evolve.md`, replace:

```markdown
1. 读取 `skills/learn/<category>/`、project instincts 和 global instincts 中的相关模式。
```

With:

```markdown
1. 优先读取 `skills/learn/<category>/` 中已沉淀的学习模式；project instincts、global instincts 和 observations 仅作为候选证据来源。
```

- [x] **Step 2: Update `/evolve` project isolation note**

Replace:

```markdown
- legacy `~/.claude/homunculus/instincts` 仅作为迁移前兼容来源。
```

With:

```markdown
- legacy `~/.claude/homunculus/instincts` 仅作为迁移前兼容来源；演化前应先经 `/learn-eval` 或人工确认沉淀到 `skills/learn/<category>/`。
```

- [x] **Step 3: Update `/learn-eval` save target wording**

In `commands/learn-eval.md`, replace:

```markdown
- **全局** (`~/.claude/skills/learn/<category>/`): 跨项目可复用的通用模式
- **项目** (`.claude/skills/learn/<category>/`): 项目特定的知识
```

With:

```markdown
- **全局** (`~/.claude/skills/learn/<category>/` 或 `~/.codex/skills/learn/<category>/`): 跨项目可复用的通用模式
- **项目** (`.claude/skills/learn/<category>/` 或项目约定的等价目录): 项目特定的知识
```

- [x] **Step 4: Add candidate source note to `/learn-eval`**

After the classification bullet list, add:

```markdown
- `homunculus`、project instincts、global instincts 和 `observations.jsonl` 只能作为候选来源；保存后的权威学习产物必须落在 `skills/learn/<category>/`。
```

- [x] **Step 5: Update `rules/common/skills-learning.md`**

Replace:

```markdown
- 学习产物必须按分类保存到 `skills/learn/<category>/`，例如 `skills/learn/pr/xxx.md`；禁止直接平铺到 `skills/learn/` 根目录。
- 后台观察或 observer 只在明确需要时开启。
```

With:

```markdown
- 学习产物必须按分类保存到 `skills/learn/<category>/`，例如 `skills/learn/pr/xxx.md`；禁止直接平铺到 `skills/learn/` 根目录。
- `homunculus`、project instincts、global instincts 和 `observations.jsonl` 只作为观察、候选或迁移来源；最终可复用学习产物以 `skills/learn/<category>/` 为准。
- 后台观察或 observer 只在明确需要时开启。
```

- [x] **Step 6: Verify learning path text**

Run:

```powershell
Select-String -Path commands\evolve.md,commands\learn-eval.md,rules\common\skills-learning.md -Pattern 'skills/learn/<category>|homunculus|instincts|observations.jsonl'
```

Expected: each file distinguishes final learning artifacts from candidate sources.

### Task 4: Strengthen Harness Verification

**Files:**
- Modify: `scripts/verify-harness.js`

- [x] **Step 1: Add `skills/learn` to managed files**

In `managedFiles()`, add this root after `skills/verification-before-completion`:

```javascript
    "skills/learn",
```

- [x] **Step 2: Add README tree path check function**

Add this function after `checkCommands()`:

```javascript
function checkReadmeTreePaths() {
  if (!exists("README.md")) return;

  const body = read("README.md");
  const treeMatch = body.match(/## 目录结构[\s\S]*?```([\s\S]*?)```/);
  if (!treeMatch) {
    fail("README.md should include a directory tree under ## 目录结构");
    return;
  }

  const ignored = new Set([
    "claude-everything-Workflow",
    "agents/...",
  ]);

  for (const rawLine of treeMatch[1].split(/\r?\n/)) {
    const match = rawLine.match(/[├└]──\s+([^#\s]+)/);
    if (!match) continue;

    const normalized = match[1].replace(/\/$/, "");
    if (!normalized || ignored.has(normalized)) continue;

    const pathInTree = normalized.replace(/\\/g, "/");
    if (!exists(pathInTree)) {
      fail(`README directory tree lists missing path: ${pathInTree}`);
    }
  }
}
```

- [x] **Step 3: Add install script parity check**

Add this function after `checkReadmeTreePaths()`:

```javascript
function checkInstallRuntimePolicy() {
  requireTokens("README.md", [
    "Codex 安装共享 Workflow 材料，不默认消费 Claude Code `settings.json`",
    "Codex 安装同一套 `hooks/` 脚本材料，但不会因为安装本仓文件而自动启用 Claude Code hooks",
  ]);

  requireTokens("scripts/install.ps1", [
    "Copy-ClaudeSettings",
    "Install-CodexWorkflow",
    "Copy-ConfigFile -Source (Join-Path $RootDir \"AGENTS.md\")",
  ]);
  requireTokens("scripts/install.sh", [
    "copy_claude_settings",
    "install_codex()",
    "copy_file \"$ROOT_DIR/AGENTS.md\" \"$dest/AGENTS.md\"",
  ]);

  const ps = read("scripts/install.ps1");
  const sh = read("scripts/install.sh");
  const sharedDirs = [
    "rules",
    "agents",
    "commands",
    "scripts",
    "hooks",
    "skills",
    "homunculus",
    "references",
  ];

  for (const dir of sharedDirs) {
    if (!ps.includes(`"${dir}"`)) {
      fail(`scripts/install.ps1 shared dirs should include ${dir}`);
    }
    if (!sh.includes(`copy_dir ${dir} "$dest"`)) {
      fail(`scripts/install.sh shared dirs should include ${dir}`);
    }
  }

  const psCodexBody = ps.match(/function Install-CodexWorkflow \{[\s\S]*?\n\}/);
  if (psCodexBody && psCodexBody[0].includes("settings.json")) {
    fail("Install-CodexWorkflow should not install Claude Code settings.json");
  }

  const shCodexBody = sh.match(/install_codex\(\) \{[\s\S]*?\n\}/);
  if (shCodexBody && shCodexBody[0].includes("settings.json")) {
    fail("install_codex should not install Claude Code settings.json");
  }
}
```

- [x] **Step 4: Add hook config reference check**

Add this function after `checkInstallRuntimePolicy()`:

```javascript
function checkHookConfigReferences() {
  if (!exists("settings.json")) {
    fail("settings.json is missing");
    return;
  }

  const settings = JSON.parse(read("settings.json"));
  const commands = [];

  function collect(value) {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value !== "object") return;
    if (typeof value.command === "string") {
      commands.push(value.command);
    }
    Object.values(value).forEach(collect);
  }

  collect(settings.hooks);

  for (const command of commands) {
    if (command.includes("$HOME/.codex")) {
      fail("settings.json should not point hooks at ~/.codex");
    }
    const matches = [...command.matchAll(/\$HOME\/\.claude\/([^" ]+)/g)];
    for (const match of matches) {
      const referenced = match[1];
      if (!exists(referenced)) {
        fail(`settings.json references missing hook path: ${referenced}`);
      }
    }
  }
}
```

- [x] **Step 5: Add learning path policy check**

Add this function after `checkHookConfigReferences()`:

```javascript
function checkLearningPathPolicy() {
  for (const dir of [
    "skills/learn",
    "skills/learn/pr",
    "skills/learn/testing",
    "skills/learn/debugging",
  ]) {
    if (!exists(dir)) {
      fail(`${dir} is missing`);
    }
  }

  if (exists("skills/learn")) {
    const rootEntries = fs.readdirSync(rel("skills/learn"), {
      withFileTypes: true,
    });
    for (const entry of rootEntries) {
      if (entry.isFile() && ![".gitkeep", "README.md"].includes(entry.name)) {
        fail(`skills/learn root should not contain ${entry.name}; use a category directory`);
      }
    }
  }

  requireTokens("README.md", [
    "skills/learn/<category>/",
    "观察、候选和迁移来源",
  ]);
  requireTokens("commands/evolve.md", [
    "skills/learn/<category>/",
    "候选证据来源",
  ]);
  requireTokens("commands/learn-eval.md", [
    "skills/learn/<category>/",
    "权威学习产物",
  ]);
  requireTokens("rules/common/skills-learning.md", [
    "skills/learn/<category>/",
    "最终可复用学习产物",
  ]);
}
```

- [x] **Step 6: Call the new checks from `main()`**

Update `main()` so the new checks run after `checkCommands()`:

```javascript
function main() {
  checkCommands();
  checkReadmeTreePaths();
  checkInstallRuntimePolicy();
  checkHookConfigReferences();
  checkLearningPathPolicy();
  checkRouterTargets();
  checkSkillLinks();
  checkRuleLoadingPolicy();
  checkSuperpowersDevLoop();
  checkForbiddenCommandDrift();
  checkScriptLayout();
  checkContinuousLearningV21();
  checkObserveV2();
  checkGitDiffWhitespace();
```

- [x] **Step 7: Run the expected failing check before docs are fully aligned**

Run after adding checks but before completing Tasks 1-3 if doing strict TDD:

```powershell
node scripts\verify-harness.js
```

Expected: FAIL with messages for missing `skills/learn` directories or missing README learning/runtime text. If Tasks 1-3 were already completed first, skip this red step and record that the plan order made the check pass immediately.

- [x] **Step 8: Run the passing check after Tasks 1-4 are complete**

Run:

```powershell
node scripts\verify-harness.js
```

Expected:

```text
Harness verification passed.
```

### Task 5: Final Verification And Review

**Files:**
- Verify all files touched by Tasks 1-4.

- [x] **Step 1: Apply completion-verification gate**

Use `skills/verification-before-completion/SKILL.md` to identify evidence required before claiming completion:

```text
Required evidence:
- node scripts\verify-harness.js
- powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DryRun
- bash scripts/install.sh --dry-run
- git diff --check
- manual README/runtime/learning path review
```

- [x] **Step 2: Run harness verification**

Run:

```powershell
node scripts\verify-harness.js
```

Expected:

```text
Harness verification passed.
```

- [x] **Step 3: Run PowerShell install dry run**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DryRun
```

Expected:

```text
Installing Claude workflow to ...
Installing Codex workflow to ...
Install complete.
```

Also inspect output and confirm Claude mentions `settings.json` merge while Codex does not.

- [x] **Step 4: Run Bash install dry run**

Run:

```powershell
bash scripts/install.sh --dry-run
```

Expected:

```text
Installing Claude workflow to ...
Installing Codex workflow to ...
Install complete.
```

If WSL emits an unrelated localhost warning before script output, record it as environmental noise only if the script exits 0.

- [x] **Step 5: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected: exit code 0 with no output.

- [x] **Step 6: Manual spec compliance review**

Run:

```powershell
Select-String -Path README.md,commands\evolve.md,commands\learn-eval.md,rules\common\skills-learning.md -Pattern 'settings.json|Codex|Claude Code hooks|skills/learn/<category>|观察、候选|权威学习产物'
git status --short
```

Expected:

- Codex is not described as automatically consuming Claude Code `settings.json`.
- Learning artifacts are described as `skills/learn/<category>/`.
- `.claude/` remains untracked and unrelated.

- [x] **Step 7: Code quality review checklist**

Inspect `scripts/verify-harness.js` and confirm:

- Each new check is a focused function.
- No function exceeds 80 lines.
- No command parsing depends on brittle full README formatting beyond the current directory tree block.
- No destructive filesystem operations were added.
- Failure messages identify exact files or policy violations.

- [x] **Step 8: Update plan status**

Mark each completed checkbox in this plan as complete only after its command or review passes.

## Self-Review

Spec coverage:

- Runtime layering is covered by Tasks 2 and 4.
- Learning path authority is covered by Tasks 1, 3, and 4.
- README/commands/rules consistency is covered by Tasks 2 and 3.
- Harness verification strengthening is covered by Task 4.
- Required verification commands are covered by Task 5.

Placeholder scan:

- This plan contains no placeholder implementation steps.

Type and path consistency:

- All paths use existing repository locations or the spec-mandated `skills/learn/<category>/` directories.
- New JavaScript functions use existing helper functions `exists`, `read`, `rel`, `fail`, and `requireTokens`.


