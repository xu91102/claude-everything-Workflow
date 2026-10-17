# CEW × GPT 真实任务对照评测（Pilot 01）

2026-10-18 · 模型 `gpt-6.1-sol`（reasoning=high）· Codex 宿主

## 结论

在 7 个真实开源修复任务上：

| 指标 | 裸跑 GPT | GPT + CEW | 变化 |
| --- | --- | --- | --- |
| 完成率 | 8/8 | 8/8 | 无差异（天花板） |
| 新增回归 | 0 | 0 | 无差异 |
| 总输入 token | 2.10M | 3.53M | **+68%** |
| 未缓存输入 | 235k | 323k | **+37%** |
| 输出 token | 19,957 | 30,637 | **+54%** |
| 总耗时 | 752s | 1,039s | **+38%** |
| 平均命令数 | 10.3 | 18.9 | **+84%** |
| 源码改动行（合计） | 170 | 148 | 无显著差异 |

CEW 的规则与技能确实被加载并执行（8/8 读取技能 3–5 个、规则 1–5 份，8/8 跑了 lint），
但在这批“单文件、测试已给出”的任务上，这些动作没有转化为更高的完成率或更好的补丁。

**Opus 5.5 对照组未能运行**：本机 `cpass.cc` 网关 502、官方 OAuth 实际未登录、
备用网关 key 过期。因此本报告不能回答“CEW 能否让 GPT 追上 Opus 5.5”。

## P0 改造后复测（同日）

按 `improvement-plan-2026-10-18.html` 的 P0-1 / P0-2 改完 `AGENTS.md`、
`using-superpowers/SKILL.md`、`rules/common/testing.md`（分支 `codex/fast-path-stop-conditions`），
用同一 7 题、每格 2 次重复做 2×2 配对：

| 指标（每次运行均值） | 裸跑 | 原 CEW | 新 CEW | 新 CEW vs 裸跑 |
| --- | --- | --- | --- | --- |
| 完成率 | 14/14 | 8/8 | 14/14 | 持平 |
| 输入 token | 243,344 | 440,954 | 185,502 | **-24%** |
| 未缓存输入 | 28,295 | 40,410 | 24,524 | -13% |
| 输出 token | 2,071 | 3,830 | 1,604 | -23% |
| 命令数 | 9.6 | 18.9 | 6.9 | **-28%** |
| 耗时 | 79s | 130s | 69s | -13% |
| 源码改动行 | 16.5 | 18.5 | 14.8 | 略少，非“少做” |

过程指标：读取技能 8/8 → **0/7**；读取规则 8/8 → 0/7；跑定向测试 8/14 → 11/14（没有靠少验证省钱）；
新增失败 0，改测试 0，虚报 0。

**噪声必须先说**：同一题同配置重跑两次，裸跑自身输入 token 比值中位 **1.36x**（1.01–2.66x）。
所以“-24%”小于单次噪声，结论依据是 14 对配对 + 6/7 任务方向一致，只能作方向性判断。

第一版还翻过一次车：`humanize-381` 花到 900k（3.57x），原因是把“公开类型放宽为 Iterable”
判成公共 API 变更后切回全流程（读 5 个技能 + 构建 + doctest）。补“升级是增量的”后同题降到 193k。

固定上下文探针（同一句“ok”，各 2 次一致）：裸跑 14,203 → 新 CEW 16,268，**+2,065**；
其中 AGENTS.md 从 2.8KB 增到 5.2KB（约 +582/次）。这是常驻成本，需靠 P2-1 分层回收。

## 任务来源

| 任务 | 仓库 | 提交 | 内容 |
| --- | --- | --- | --- |
| slugify-200 | python-slugify | 8f9a550 | modern 截断尾部残留分隔符 |
| slugify-194 | python-slugify | 2f23599 | add_uppercase_char 出错时不改输入 |
| humanize-346 | humanize | ca892b3 | intword 超大数进位舍入 |
| humanize-381 | humanize | ffdf407 | natural_list 支持任意可迭代对象 |
| more-itertools-1284 | more-itertools | 2b8d5cd | bucket 查询不应凭空造键 |
| more-itertools-1247 | more-itertools | dc2664b | numeric_range 长度/成员/索引一致 |
| itsdangerous-sha1 | itsdangerous | 7f4dcf8 | 惰性访问 sha1 |

构造方式：父提交 + 该提交的测试补丁；父版本必须失败、真实修复必须通过，才纳入评测。

## 文件

- `cew-gpt-benchmark-2026-10-18.html` — 可视化报告（结论、方法、逐任务数据、局限）
- `improvement-plan-2026-10-18.html` — 改进方案 + P0 实测结果
- `data/summary.csv` — 第一批逐次运行原始数据（16 次）
- `data/summary-p0.csv` — P0 复测原始数据（36 次：3 组 × 7 题 × 2 次，含第一批）
- `data/p0-stats.json` — 2×2 配对统计、逐题比值、基线重复噪声
- `data/summary.json` — 含最终消息、失败用例、diff 文件列表
- `tools/run_trial.py` — 单次运行 + 自动判分（cell 含 `gpt-fixed`）
- `tools/validate_tasks.py` — 任务有效性检查
- `tools/discover.py` — 从仓库历史筛选候选修复提交
- `tools/aggregate.py` — 聚合统计
- `tools/compare.py` — 三组逐题对照
- `tools/p0_stats.py` — P0 配对统计
- `tools/tasks.validated.json` — 任务清单

## 复现

脚本按 `/tmp/cew-eval` 布局编写，需要先准备：

```text
/tmp/cew-eval/
├── repos/          # 四个仓库的完整克隆
├── venvs/          # 每个仓库独立 venv（pytest 等）
├── homes/          # codex-base、cew-home、claude-base
└── tools/
```

```sh
cp -r docs/eval/tools /tmp/cew-eval/tools
python3 /tmp/cew-eval/tools/validate_tasks.py        # 验证任务
python3 /tmp/cew-eval/tools/run_trial.py --task slugify-200 --cell gpt-base
python3 /tmp/cew-eval/tools/run_trial.py --task slugify-200 --cell gpt-cew
python3 /tmp/cew-eval/tools/run_trial.py --task slugify-200 --cell gpt-fixed   # 需先装新 CEW 到 homes/cew-fixed
python3 /tmp/cew-eval/tools/aggregate.py
python3 /tmp/cew-eval/tools/p0_stats.py
```

装新 CEW 到隔离环境（不要污染本机 `~/.codex`）：

```sh
git -C <worktree> checkout codex/fast-path-stop-conditions
HOME=/tmp/cew-eval/homes/cew-fixed <worktree>/scripts/install.sh --codex-only
cp ~/.codex/config.toml ~/.codex/auth.json /tmp/cew-eval/homes/cew-fixed/.codex/
```

## 局限

- 7 个任务偏简单，测试对代理可见，存在天花板效应，无法区分模型能力上限。
- 每组每格 2 次重复（第一批为 1 次）；基线自身重复波动中位数 1.36x，效应量小于噪声时只能作方向性结论。
- 未做显著性检验，也未做盲评代码质量。
- 只覆盖 Codex 宿主；Claude Code 未覆盖。
- Opus 5.5 臂仍缺失，端到端“追平 Opus”问题未回答。
- Codex 内层沙箱与 WorkBuddy 沙箱冲突，两侧统一改为直接执行。
