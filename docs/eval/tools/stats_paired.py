#!/usr/bin/env python3
"""Paired statistics for the final 42-trial benchmark.

Pure stdlib: exact sign test, exact sign-flip permutation test (on the mean of
log ratios), and a task-clustered bootstrap CI. Clustering matters because the
two runs of the same task are not independent samples of "tasks".
"""

import argparse
import csv
import json
import math
import os
import random
from collections import defaultdict
from statistics import stdev

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CSV = os.path.join(ROOT, "data", "final-2026-10-18", "trials.csv")
METRICS = [
    "total_tokens",
    "input_tokens",
    "uncached_input_tokens",
    "output_tokens",
    "agent_duration_s",
]


def load(path):
    by = defaultdict(dict)
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            key = (r["task"], int(r["run"]))
            by[key][r["cell"]] = {m: float(r[m]) for m in METRICS}
    cells = sorted({c for v in by.values() for c in v})
    return by, cells


def sign_test(deltas):
    """Exact two-sided binomial test on sign(delta), ties dropped."""
    pos = sum(1 for d in deltas if d > 0)
    neg = sum(1 for d in deltas if d < 0)
    n = pos + neg
    if n == 0:
        return 1.0, pos, neg, 0
    k = min(pos, neg)
    tail = sum(math.comb(n, i) for i in range(k + 1)) / (2**n)
    return min(1.0, 2 * tail), pos, neg, n


def signflip_p(deltas, iters=20000, seed=0):
    """Two-sided sign-flip permutation test on mean(delta).

    Exact enumeration when n <= 16, otherwise Monte Carlo.
    """
    n = len(deltas)
    obs = abs(sum(deltas) / n)
    if n <= 16:
        hits = 0
        total = 1 << n
        for mask in range(total):
            s = 0.0
            for i in range(n):
                s += -deltas[i] if (mask >> i) & 1 else deltas[i]
            if abs(s / n) >= obs - 1e-12:
                hits += 1
        return hits / total
    rng = random.Random(seed)
    hits = 0
    for _ in range(iters):
        s = 0.0
        for d in deltas:
            if rng.random() < 0.5:
                s -= d
            else:
                s += d
        if abs(s / n) >= obs - 1e-12:
            hits += 1
    return hits / iters


def mean(xs):
    return sum(xs) / len(xs)


def median(xs):
    s = sorted(xs)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def pct(x):
    return 100.0 * x


def bootstrap_ci(vals, iters=20000, seed=1):
    """Percentile bootstrap over the supplied units (already clustered)."""
    rng = random.Random(seed)
    n = len(vals)
    out = []
    for _ in range(iters):
        out.append(mean([vals[rng.randrange(n)] for _ in range(n)]))
    out.sort()
    return out[int(0.025 * iters)], out[int(0.975 * iters) - 1]


def compare(by, arm, ref, metric):
    """Return per-pair ratios and per-task clustered means."""
    pairs = []
    per_task = defaultdict(list)
    for (task, run), cells in sorted(by.items()):
        a, b = cells[arm][metric], cells[ref][metric]
        if b <= 0:
            continue
        ratio = a / b
        pairs.append({"task": task, "run": run, "ratio": ratio})
        per_task[task].append(ratio)
    task_means = {t: mean(v) for t, v in per_task.items()}
    return pairs, task_means


def required_n(sd, delta, alpha_z=1.96, power_z=0.84):
    """Two-sided two-sample-equivalent n for a relative change `delta`."""
    return math.ceil(((alpha_z + power_z) ** 2 * sd**2) / (math.log(1 + delta) ** 2))


def report(by, arm, ref, metric):
    pairs, task_means = compare(by, arm, ref, metric)
    ratios = [p["ratio"] for p in pairs]
    logs = [math.log(r) for r in ratios]
    tm = list(task_means.values())
    tlog = [math.log(r) for r in tm]
    sd = stdev(tlog) if len(tlog) > 1 else 0.0

    p_sign, pos, neg, _n = sign_test(logs)
    p_flip = signflip_p(logs)
    p_task_flip = signflip_p(tlog)
    lo, hi = bootstrap_ci(tlog)

    return {
        "arm": arm,
        "ref": ref,
        "metric": metric,
        "n_pairs": len(ratios),
        "n_tasks": len(tm),
        "mean_ratio": mean(ratios),
        "median_ratio": median(ratios),
        "min_ratio": min(ratios),
        "max_ratio": max(ratios),
        "better_pairs": sum(1 for r in ratios if r < 1),
        "worse_pairs": sum(1 for r in ratios if r > 1),
        "task_mean_ratio_geo": math.exp(mean(tlog)),
        "task_clustered_ci95": [math.exp(lo), math.exp(hi)],
        "sign_test_p": p_sign,
        "sign_test_pos_neg": [pos, neg],
        "signflip_p_pairs": p_flip,
        "signflip_p_tasks": p_task_flip,
        "sd_log_tasks": sd,
        "n_for_10pct_80power": required_n(sd, 0.10) if sd else None,
        "n_for_5pct_80power": required_n(sd, 0.05) if sd else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=DEFAULT_CSV)
    ap.add_argument("--json-out", default="")
    a = ap.parse_args()

    by, cells = load(a.csv)
    print(
        f"cells: {cells}  units: {len(by)}  balanced={all(set(v) == set(cells) for v in by.values())}"
    )

    out = {"cells": cells, "comparisons": []}
    for arm, ref in [
        ("gpt-fixed", "gpt-cew"),
        ("gpt-fixed", "gpt-base"),
        ("gpt-cew", "gpt-base"),
    ]:
        for metric in METRICS:
            r = report(by, arm, ref, metric)
            out["comparisons"].append(r)
            print(
                f"{arm} vs {ref:9s} {metric:22s} "
                f"mean={r['mean_ratio']:.3f}x median={r['median_ratio']:.3f}x "
                f"geo(task)={r['task_mean_ratio_geo']:.3f}x "
                f"CI95=[{r['task_clustered_ci95'][0]:.3f},{r['task_clustered_ci95'][1]:.3f}] "
                f"better/worse={r['better_pairs']}/{r['worse_pairs']} "
                f"sign_p={r['sign_test_p']:.3f} flip_pairs={r['signflip_p_pairs']:.3f} flip_tasks={r['signflip_p_tasks']:.3f}"
            )

    if a.json_out:
        with open(a.json_out, "w") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
        print("wrote", a.json_out)


if __name__ == "__main__":
    main()
