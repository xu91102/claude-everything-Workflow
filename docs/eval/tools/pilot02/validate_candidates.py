#!/usr/bin/env python3
"""Pick behavior-change candidates and validate them (base must fail, fix must pass)."""
import json, os, re, shutil, subprocess, sys, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

ROOT = "/tmp/cew-eval"
SKIP_RE = re.compile(r"\b(type hints?|typing|pyupgrade|black|format(ting)?|reformat|lint|config|"
                     r"translation|catalog|locale|docs?|readme|release|bump|version|"
                     r"remove deprecated|rename|refactor)\b", re.I)


def sh(args, cwd=None, env=None):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, env=env)


def run_tests(repo, wt, test_files, tag, tid):
    py = f"{ROOT}/venvs/{repo}/bin/python"
    src = os.path.join(wt, "src")
    pp = src if os.path.isdir(src) else wt
    env = os.environ.copy()
    env["PYTHONPATH"] = pp
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env.pop("HTTP_PROXY", None)
    env["NO_PROXY"] = "127.0.0.1,localhost"
    out = f"{ROOT}/results/val-{tid}-{tag}.xml"
    cmd = [py, "-m", "pytest", "-q", "--tb=no", "-p", "no:cacheprovider", f"--junitxml={out}"] + test_files
    r = sh(cmd, cwd=wt, env=env)
    passed = failed = 0
    if os.path.exists(out):
        root = ET.parse(out).getroot()
        for tc in root.iter("testcase"):
            bad = tc.find("failure") is not None or tc.find("error") is not None
            passed += not bad
            failed += bad
    return {"exit": r.returncode, "passed": passed, "failed": failed,
            "tail": (r.stdout or "")[-300:]}


def validate(c):
    repo, commit = c["repo"], c["commit"]
    tid = f'{repo}-{commit[:7]}'
    repo_dir = f"{ROOT}/repos/{repo}"
    base_wt = f"{ROOT}/worktrees/h-{tid}-base"
    fix_wt = f"{ROOT}/worktrees/h-{tid}-fix"
    for p in (base_wt, fix_wt):
        sh(["git", "worktree", "remove", "--force", p], cwd=repo_dir)
        shutil.rmtree(p, ignore_errors=True)
    if sh(["git", "worktree", "add", "--detach", base_wt, f"{commit}^"], cwd=repo_dir).returncode != 0:
        return None
    if sh(["git", "worktree", "add", "--detach", fix_wt, commit], cwd=repo_dir).returncode != 0:
        return None
    patch = sh(["git", "diff", f"{commit}^", commit, "--"] + c["tests"], cwd=repo_dir).stdout
    ap = subprocess.run(["git", "apply", "-"], cwd=base_wt, text=True, input=patch, capture_output=True)
    if ap.returncode != 0:
        return {**c, "id": tid, "valid": False, "why": "test patch conflict"}
    base = run_tests(repo, base_wt, c["tests"], "base", tid)
    fix = run_tests(repo, fix_wt, c["tests"], "fix", tid)
    ok = base["failed"] > 0 and fix["exit"] == 0 and fix["failed"] == 0 and fix["passed"] > 0
    return {**c, "id": tid, "test_files": c["tests"], "base": base, "fix": fix, "valid": ok}


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else f"{ROOT}/candidates.all.json"
    out_path = sys.argv[2] if len(sys.argv) > 2 else f"{ROOT}/tasks.hard.candidates.json"
    cands = json.load(open(src))
    repo_hint = os.path.basename(src).replace("cand-", "").replace(".json", "")
    for c in cands:
        c.setdefault("repo", repo_hint)
    picked, seen = [], set()
    per_repo = {}
    for c in cands:
        if SKIP_RE.search(c["subject"]):
            continue
        if c["lines"] > 300:
            continue
        cap = {"more-itertools": 14, "flask": 12}.get(c["repo"], 10)
        if per_repo.get(c["repo"], 0) >= cap:
            continue
        key = (c["repo"], c["subject"])
        if key in seen:
            continue
        seen.add(key)
        per_repo[c["repo"]] = per_repo.get(c["repo"], 0) + 1
        picked.append(c)
    print(f"selected {len(picked)} candidates", file=sys.stderr)
    os.makedirs(f"{ROOT}/results", exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as ex:
        results = [r for r in ex.map(validate, picked) if r]
    valid = [r for r in results if r["valid"]]
    valid.sort(key=lambda x: -x["score"])
    json.dump(valid, open(out_path, "w"), indent=2, ensure_ascii=False)
    for r in results:
        base = r.get("base") or {}
        fix = r.get("fix") or {}
        print(json.dumps({"id": r["id"], "valid": r["valid"], "lines": r["lines"],
                          "base": [base.get("passed", 0), base.get("failed", 0)],
                          "fix": [fix.get("passed", 0), fix.get("failed", 0)],
                          "why": r.get("why", "")}, ensure_ascii=False))
    print(f"valid {len(valid)}/{len(results)}", file=sys.stderr)


if __name__ == "__main__":
    main()
