#!/usr/bin/env python3
"""Aggregate trial results into summary.json + summary.csv."""
import json, glob, csv, collections, os, subprocess

ROOT = "/tmp/cew-eval"


def cmd_counts(log):
    c = collections.Counter()
    for line in open(log, errors="ignore"):
        try:
            e = json.loads(line)
        except Exception:
            continue
        if e.get("type") == "item.completed":
            c[e.get("item", {}).get("type")] += 1
    return c


def main():
    rows = []
    for f in glob.glob(f"{ROOT}/results/*/*/result.json"):
        d = json.load(open(f))
        if d["cell"] not in ("gpt-base", "gpt-cew", "gpt-fixed", "opus-base", "opus-cew"):
            continue
        u = d["usage"]
        d["uncached_input"] = u.get("input_tokens", 0) - u.get("cached_input_tokens", 0)
        d["commands"] = cmd_counts(d["agent"]["log"]).get("command_execution", 0)
        d["file_changes"] = cmd_counts(d["agent"]["log"]).get("file_change", 0)
        # source-only diff (exclude test files)
        run_dir = f"{ROOT}/runs/{d['task']}/{d['cell']}-r{d['run']}"
        src = 0
        if os.path.isdir(run_dir):
            ns = subprocess.run(["git", "diff", "--cached", "--numstat", "HEAD"], cwd=run_dir,
                                text=True, capture_output=True).stdout
            for ln in ns.splitlines():
                p = ln.split("\t")
                if len(p) == 3 and p[0].isdigit() and "test" not in p[2]:
                    src += int(p[0]) + int(p[1])
        d["src_lines"] = src
        rows.append(d)
    rows.sort(key=lambda x: (x["repo"], x["task"], x["cell"]))
    summary = {}
    for cell in sorted({r["cell"] for r in rows}):
        rs = [r for r in rows if r["cell"] == cell]
        summary[cell] = {
            "trials": len(rs),
            "resolved": sum(1 for r in rs if r["resolved"]),
            "new_failures": sum(len(r["new_failures"]) for r in rs),
            "overclaim": sum(1 for r in rs if r["overclaim"]),
            "tests_modified": sum(1 for r in rs if r["tests_modified"]),
            "input_tokens": sum(r["usage"].get("input_tokens", 0) for r in rs),
            "cached_input": sum(r["usage"].get("cached_input_tokens", 0) for r in rs),
            "uncached_input": sum(r["uncached_input"] for r in rs),
            "output_tokens": sum(r["usage"].get("output_tokens", 0) for r in rs),
            "reasoning_tokens": sum(r["usage"].get("reasoning_output_tokens", 0) for r in rs),
            "duration_s": sum(r["agent"]["duration_s"] for r in rs),
            "diff_lines": sum(r["diff"]["lines"] for r in rs),
            "commands": sum(r["commands"] for r in rs),
        }
    json.dump({"summary": summary, "trials": rows}, open(f"{ROOT}/summary.json", "w"),
              indent=2, ensure_ascii=False)
    with open(f"{ROOT}/summary.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["task", "repo", "cell", "run", "resolved", "input_tokens", "cached_input",
                    "uncached_input", "output_tokens", "reasoning_tokens", "duration_s",
                    "diff_lines", "src_lines", "commands", "new_failures", "overclaim"])
        for r in rows:
            w.writerow([r["task"], r["repo"], r["cell"], r["run"], r["resolved"],
                        r["usage"].get("input_tokens", 0), r["usage"].get("cached_input_tokens", 0),
                        r["uncached_input"], r["usage"].get("output_tokens", 0),
                        r["usage"].get("reasoning_output_tokens", 0), r["agent"]["duration_s"],
                        r["diff"]["lines"], r["src_lines"], r["commands"], len(r["new_failures"]), r["overclaim"]])
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
