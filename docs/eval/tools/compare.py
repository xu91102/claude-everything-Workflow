#!/usr/bin/env python3
"""Paired comparison: gpt-base vs gpt-cew vs gpt-fixed on the same tasks."""
import csv, statistics, sys

ROOT = "/tmp/cew-eval"
rows = list(csv.DictReader(open(f"{ROOT}/summary.csv")))
by = {}
for r in rows:
    by.setdefault(r["task"], {})[r["cell"]] = r

cells = ["gpt-base", "gpt-cew", "gpt-fixed"]
tasks = sorted(by)

print(f"{'task':24s} {'cell':10s} {'ok':3s} {'in_tok':>9s} {'unc':>8s} {'out':>6s} {'cmds':>5s} {'sec':>6s}")
for t in tasks:
    for c in cells:
        r = by[t].get(c)
        if not r:
            continue
        print(f"{t:24s} {c:10s} {str(r['resolved'])[:1]:3s} {int(r['input_tokens']):9,d} "
              f"{int(r['uncached_input']):8,d} {int(r['output_tokens']):6,d} "
              f"{int(r['commands']):5d} {float(r['duration_s']):6.0f}")
    print()

print("== paired totals (tasks present in all three cells) ==")
common = [t for t in tasks if all(c in by[t] for c in cells)]
for c in cells:
    rs = [by[t][c] for t in common]
    print(f"{c:10s} n={len(rs)} ok={sum(r['resolved']=='True' for r in rs)} "
          f"in={sum(int(r['input_tokens']) for r in rs):,} "
          f"unc={sum(int(r['uncached_input']) for r in rs):,} "
          f"out={sum(int(r['output_tokens']) for r in rs):,} "
          f"cmds={sum(int(r['commands']) for r in rs)} "
          f"sec={sum(float(r['duration_s']) for r in rs):.0f}")

print()
print("== delta vs gpt-base ==")
for c in ["gpt-cew", "gpt-fixed"]:
    if not all(c in by[t] for t in common):
        continue
    ratios = []
    for t in common:
        b, x = by[t]["gpt-base"], by[t][c]
        ratios.append(int(x["input_tokens"]) / int(b["input_tokens"]))
    b = [by[t]["gpt-base"] for t in common]
    x = [by[t][c] for t in common]
    bi, xi = sum(int(r["input_tokens"]) for r in b), sum(int(r["input_tokens"]) for r in x)
    bc, xc = sum(int(r["commands"]) for r in b), sum(int(r["commands"]) for r in x)
    bs, xs = sum(float(r["duration_s"]) for r in b), sum(float(r["duration_s"]) for r in x)
    bu, xu = sum(int(r["uncached_input"]) for r in b), sum(int(r["uncached_input"]) for r in x)
    print(f"{c:10s} input {(xi/bi-1)*100:+6.1f}%  uncached {(xu/bu-1)*100:+6.1f}%  "
          f"cmds {(xc/bc-1)*100:+6.1f}%  sec {(xs/bs-1)*100:+6.1f}%  "
          f"median per-task ratio {statistics.median(ratios):.2f}x  "
          f"min {min(ratios):.2f}x max {max(ratios):.2f}x")
