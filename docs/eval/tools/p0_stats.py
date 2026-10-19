#!/usr/bin/env python3
"""P0 verification stats: 2x2 paired comparison (base vs fixed), CEW as reference."""
import csv, json, statistics, collections

ROOT = "/tmp/cew-eval"
rows = list(csv.DictReader(open(f"{ROOT}/summary.csv")))

runs = collections.defaultdict(list)   # (task, cell) -> [row]
for r in rows:
    runs[(r["task"], r["cell"])].append(r)
for k in runs:
    runs[k].sort(key=lambda r: int(r["run"]) if r["run"].isdigit() else 0)

tasks = sorted({r["task"] for r in rows})


def num(r, k, cast=float):
    return cast(float(r[k]))


def mean(rs, k, cast=float):
    return sum(num(r, k, cast) for r in rs) / len(rs)


cells = ["gpt-base", "gpt-cew", "gpt-fixed"]
common = [t for t in tasks if all((t, c) in runs for c in cells)]

out = {"tasks": [], "totals": {}, "delta": {}, "noise": {}}

for t in common:
    entry = {"task": t, "repo": runs[(t, "gpt-base")][0]["repo"], "cells": {}}
    for c in cells:
        rs = runs[(t, c)]
        entry["cells"][c] = {
            "n": len(rs),
            "ok": sum(1 for r in rs if r["resolved"] == "True"),
            "in": round(mean(rs, "input_tokens")),
            "unc": round(mean(rs, "uncached_input")),
            "cmds": round(mean(rs, "commands"), 1),
            "sec": round(mean(rs, "duration_s"), 1),
            "src": round(mean(rs, "src_lines"), 1),
            "nf": sum(int(r["new_failures"]) for r in rs),
        }
    b, f = runs[(t, "gpt-base")], runs[(t, "gpt-fixed")]
    pairs = [num(x, "input_tokens") / num(y, "input_tokens") for x in f for y in b]
    entry["ratio"] = round(mean(f, "input_tokens") / mean(b, "input_tokens"), 2)
    entry["ratio_pairs"] = [round(p, 2) for p in sorted(pairs)]
    entry["cmd_delta"] = round(mean(f, "commands") - mean(b, "commands"), 1)
    out["tasks"].append(entry)

for c in cells:
    rs = [r for t in common for r in runs[(t, c)]]
    out["totals"][c] = {
        "n": len(rs),
        "ok": sum(1 for r in rs if r["resolved"] == "True"),
        "in": round(sum(num(r, "input_tokens") for r in rs) / len(rs)),
        "unc": round(sum(num(r, "uncached_input") for r in rs) / len(rs)),
        "out": round(sum(num(r, "output_tokens") for r in rs) / len(rs)),
        "cmds": round(sum(num(r, "commands") for r in rs) / len(rs), 1),
        "sec": round(sum(num(r, "duration_s") for r in rs) / len(rs)),
        "src": round(sum(num(r, "src_lines") for r in rs) / len(rs), 1),
        "nf": sum(len(json.load(open(f"{ROOT}/results/{r['task']}/{r['cell']}-r{r['run']}/result.json"))["new_failures"]) for r in rs),
        "tests_mod": sum(1 for r in rs if json.load(open(f"{ROOT}/results/{r['task']}/{r['cell']}-r{r['run']}/result.json"))["tests_modified"]),
    }

base = out["totals"]["gpt-base"]
for c in ("gpt-cew", "gpt-fixed"):
    x = out["totals"][c]
    ratios = [e["ratio"] for e in out["tasks"]] if c == "gpt-fixed" else \
             [runs[(t, c)][0]["input_tokens"] and num(runs[(t, c)][0], "input_tokens") / num(runs[(t, "gpt-base")][0], "input_tokens") for t in common]
    out["delta"][c] = {
        "in_pct": round((x["in"] / base["in"] - 1) * 100, 1),
        "unc_pct": round((x["unc"] / base["unc"] - 1) * 100, 1),
        "out_pct": round((x["out"] / base["out"] - 1) * 100, 1),
        "cmds_pct": round((x["cmds"] / base["cmds"] - 1) * 100, 1),
        "sec_pct": round((x["sec"] / base["sec"] - 1) * 100, 1),
        "median_ratio": round(statistics.median(ratios), 2),
        "min_ratio": round(min(ratios), 2),
        "max_ratio": round(max(ratios), 2),
    }

# run-to-run noise inside the baseline itself
noise = []
for t in common:
    rs = runs[(t, "gpt-base")]
    if len(rs) > 1:
        vals = [num(r, "input_tokens") for r in rs]
        noise.append(max(vals) / min(vals))
out["noise"] = {"baseline_repeat_ratio": [round(x, 2) for x in noise],
                "baseline_repeat_median": round(statistics.median(noise), 2)}

json.dump(out, open(f"{ROOT}/p0-stats.json", "w"), indent=2, ensure_ascii=False)
print(json.dumps({"totals": out["totals"], "delta": out["delta"], "noise": out["noise"]},
                 indent=2, ensure_ascii=False))
print()
print("| task | base in | fixed in | ratio | base cmds | fixed cmds |")
print("|---|---:|---:|---:|---:|---:|")
for e in out["tasks"]:
    print(f"| {e['task']} | {e['cells']['gpt-base']['in']:,} | {e['cells']['gpt-fixed']['in']:,} | "
          f"{e['ratio']}x | {e['cells']['gpt-base']['cmds']} | {e['cells']['gpt-fixed']['cmds']} |")
