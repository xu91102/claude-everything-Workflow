#!/usr/bin/env python3
"""Pre-screen hard candidates with the bare agent; keep ones it fails or struggles on."""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = "/tmp/cew-eval"
TASKS = f"{ROOT}/tasks.hard.candidates.json"
KNOWN = {t["commit"] for t in json.load(open(f"{ROOT}/tasks.validated.json"))}


def one(task):
    tid = task["id"]
    cmd = ["/usr/bin/python3", f"{ROOT}/tools/run_trial.py", "--cell", "gpt-base",
           "--task", tid, "--run", "3", "--timeout", "600", "--tasks-file", TASKS]
    env = os.environ.copy()
    env["HTTPS_PROXY"] = env["HTTP_PROXY"] = "http://127.0.0.1:7890"
    env["NO_PROXY"] = "127.0.0.1,localhost"
    r = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, env=env)
    path = f"{ROOT}/results/{tid}/gpt-base-r3/result.json"
    if not os.path.exists(path):
        return {"id": tid, "error": (r.stderr or r.stdout)[-300:]}
    d = json.load(open(path))
    return {"id": tid, "resolved": d["resolved"], "input": d["usage"].get("input_tokens", 0),
            "cmds": sum(1 for ln in open(d["agent"]["log"], errors="ignore")
                        if '"command_execution"' in ln),
            "sec": d["agent"]["duration_s"], "timed_out": d["agent"]["timed_out"]}


def main():
    tasks = [t for t in json.load(open(TASKS)) if t["commit"] not in KNOWN]
    print(f"screening {len(tasks)} tasks", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=2) as ex:
        rows = list(ex.map(one, tasks))
    json.dump(rows, open(f"{ROOT}/prescreen.json", "w"), indent=2, ensure_ascii=False)
    for r in sorted(rows, key=lambda x: (x.get("resolved", False), -x.get("input", 0))):
        print(json.dumps(r, ensure_ascii=False))


if __name__ == "__main__":
    main()
