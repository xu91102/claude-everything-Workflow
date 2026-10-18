# CEW × GPT 真实任务对照评测

最新最终版结果见 [PR #62 最终规则复测](final-benchmark-2026-10-18.md)：三组 × 7 题 × 2 次，共 42 次实际运行。
AGENTS.md 已恢复为主分支原样。下文 Pilot/P0 数字保留作历史记录，不能当作最终版证据。

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

### 审查修正后的证据范围

上述数字来自修正前的 Fast Path 试验，不能把 −24% / −28% 当作最终规则版本的实测结果。
保留 Git 隔离、授权、相称审查和必要质量门后的 42 次重新测量，见[最终规则复测](final-benchmark-2026-10-18.md)。
该复测还修正了 SHA1 任务的测试准备；历史运行没有重新判分。

评测器现在要求 Agent 正常退出且未超时、目标测试退出码为 0 且有实际通过用例、前后完整套件均正常完成，
并且没有新增失败。已知基线失败允许退出码为 1；中断、收集错误、缺失或过期报告、全跳过均不能算完成。
完整套件显式禁用提前终止，收集或运行错误不能作为已知断言失败接受。新结果保留完整套件的退出码、跳过数、
错误数和报告错误；历史结果没有自动改写或重新判分。

## Pilot 02：困难任务集（同日）

针对“7 题太简单、天花板未破”，重挖 174 个候选提交、38 个入选、22 个有效任务（父版本失败 + 修复通过）。

| 实验 | 规模 | 结果 |
| --- | --- | --- |
| 可见测试 | 22 题（最大 241 行、5 文件） | 基线 **22/22**，平均 228k token / 22.3 命令 |
| 隐藏测试（checkout 不含测试） | 13 题 | 基线 **11/13**，失败的 2 题都是规格不足的新增功能 |
| 隐藏测试 2×2 配对 | 4 题 × 2 次 | 基线 4/8 vs CEW 5/8；331k → 461k token（**+39%**） |

隐藏测试配对里，CEW 组 8/8 读取技能、8/8 读取规则——这些题不满足微改条件，Fast Path 未生效，
成本仍按完整流程计。结论：**小型工具库对 gpt-6.1-sol 已饱和；天花板来自任务形态，不是测试可见性。**

**版本范围**：上述配对使用修正前的 Fast Path（`2a257da`）。审查修正后（`2156e79`/`f2f0d27`），
Fast Path 改为按需加载并恢复 Git 隔离与相称审查，尚未重测。当前版本 spot check（2 题）：
常驻上下文 +1,487（修正前 +2,065），但命令数 12→18、18→30，token 一题 +10%、一题 −18%，方向不一致。

详细报告：`pilot02-hard-set-2026-10-18.html`。

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
- `pilot02-hard-set-2026-10-18.html` — 困难任务集：22 个挖掘任务 + 13 个隐藏测试题 + 4 题配对
- `data/summary.csv` — 第一批逐次运行原始数据（16 次）
- `data/summary-p0.csv` — P0 复测原始数据（36 次：3 组 × 7 题 × 2 次，含第一批）
- `data/p0-stats.json` — 2×2 配对统计、逐题比值、基线重复噪声
- `data/prescreen-visible-22.json` — 22 个挖掘任务的可见测试预筛
- `data/prescreen-hidden-13.json` — 13 个隐藏测试预筛
- `data/hard2-runs.csv` — 4 题 × 2 组 × 2 次的配对原始数据
- `data/tasks.hard.json` — 困难集任务定义
- `data/summary.json` — 含最终消息、失败用例、diff 文件列表
- `data/final-2026-10-18/` — 最终 42 次对照的逐次、汇总、任务夹具与补充质量证据
- `data/final-2026-10-18/paired-stats.json` — 配对检验：符号检验、符号翻转置换检验、任务聚类自助区间
- `tools/run-trial.js` — Node.js 单次运行 + 自动判分（cell 含 `gpt-fixed`），结果格式兼容原始数据
- `tools/run-trial.test.js` — Node.js 隔离回归测试，覆盖判分和凭据处理，使用本地工具夹具，不调用模型
- `tools/validate_tasks.py` — 任务有效性检查
- `tools/discover.py` — 从仓库历史筛选候选修复提交
- `tools/aggregate.py` — 聚合统计
- `tools/compare.py` — 三组逐题对照
- `tools/p0_stats.py` — P0 配对统计
- `tools/stats_paired.py` — 最终 42 次的配对显著性检验与成本归因（纯标准库）
- `tools/pilot02/` — Pilot 02 专用：困难候选挖掘、批量验证、隐藏测试预筛（Python 判分器版本）
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
node docs/eval/tools/run-trial.js --task slugify-200 --cell gpt-base
node docs/eval/tools/run-trial.js --task slugify-200 --cell gpt-cew
node docs/eval/tools/run-trial.js --task slugify-200 --cell gpt-fixed   # 需先装新 CEW 到 homes/cew-fixed
python3 /tmp/cew-eval/tools/aggregate.py
python3 /tmp/cew-eval/tools/p0_stats.py
```

装新 CEW 到隔离环境（不要污染本机 `~/.codex`）：

```sh
git -C <worktree> checkout codex/fast-path-stop-conditions
HOME=/tmp/cew-eval/homes/cew-fixed <worktree>/scripts/install.sh --codex-only
cp ~/.codex/config.toml ~/.codex/auth.json /tmp/cew-eval/homes/cew-fixed/.codex/
```

评测脚本的本地自定义 provider 从环境变量 `CEW_EVAL_BEARER_TOKEN` 读取凭据；通过安全渠道设置该变量，
不要把值写入脚本、配置模板或报告。此前提交过的凭据若仍有效，需要在提供方撤销或轮换；删除源码无法撤销历史泄露。

运行器和判分回归使用项目已有的 Node.js 环境（Node 20+，先运行 `npm install`）；只有被测 Python 仓库自身
的 pytest 仍需要对应 venv。可用 `CEW_EVAL_ROOT` 指定隔离目录，默认 `/tmp/cew-eval`。

只运行评测器回归，不需要模型凭据或 Python 环境：

```sh
npm run test:eval
```

## 局限

- 7 个任务偏简单，测试对代理可见，存在天花板效应，无法区分模型能力上限。
- 每题每格 2 次重复（第一批为 1 次）；基线自身重复波动中位数 1.36x，效应量小于噪声时只能作方向性结论。
- 已补配对显著性检验，但 7 个任务的分辨率约 10%；5% 以内的差异在这套噪声下测不出来。
- 未做盲评代码质量。
- 只覆盖 Codex 宿主；Claude Code 未覆盖。
- Opus 5.5 臂仍缺失，端到端“追平 Opus”问题未回答。
- Codex 内层沙箱与 WorkBuddy 沙箱冲突，两侧统一改为直接执行。
