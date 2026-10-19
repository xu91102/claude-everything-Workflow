#!/usr/bin/env python3
"""Mine cross-file fix commits from a big repo and validate them mechanically.

Difficulty is approximated by: touches >=2 source files, recent enough to run on
modern Python, and a real behavior change (tests added/changed). Validation is
the same contract as Pilot 02: parent fails the touched tests, the fix passes.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

ROOT = "/tmp/cew-eval"
DOC_RE = re.compile(
    r"(^|/)(docs?|doc|news|changes|\.github)/|\.(md|rst|txt|toml|cfg|ini|yaml|yml)$"
)
INFRA_RE = re.compile(
    r"^(release|bump|version|merge|chore|docs?|typo|lint|format|fix ci|ci\b|build\b|"
    r"add pyproject|drop py|remove py|support py|update actions|"
    r"use (ruff|black|pre-commit)|update requirements|drop support|remove (uses|support)|"
    r"deprecate)",
    re.IGNORECASE,
)
TEST_DIR_RE = re.compile(r"(^|/)(tests?|testing)/")
TEST_FILE_RE = re.compile(r"(^|/)test_[^/]*\.py$|_test\.py$")


def sh(args, cwd=None, env=None):
    return subprocess.run(
        args, check=False, cwd=cwd, text=True, capture_output=True, env=env
    )


def git(args, cwd):
    return sh(["git"] + args, cwd=cwd).stdout


def discover(
    repo_dir,
    since,
    min_src,
    min_lines,
    max_lines,
    limit,
    min_new_defs=0,
    min_new_tests=0,
):
    commits = git(
        ["log", "--no-merges", f"--since={since}", f"-n{limit}", "--format=%H"],
        repo_dir,
    ).split()
    date = {}
    for c in commits:
        date[c] = git(
            ["log", "-1", "--format=%ad", "--date=short", c], repo_dir
        ).strip()
    out = []
    for c in commits:
        subj = git(["log", "-1", "--format=%s", c], repo_dir).strip()
        if INFRA_RE.search(subj):
            continue
        files, add, dele = [], 0, 0
        for line in git(["show", "--numstat", "--format=", c], repo_dir).splitlines():
            parts = line.split("\t")
            if len(parts) != 3 or parts[0] == "-":
                continue
            files.append(parts[2])
            add += int(parts[0])
            dele += int(parts[1])
        total = add + dele
        if not files or not (min_lines <= total <= max_lines):
            continue
        files = [f for f in files if not DOC_RE.search(f)]
        tests = [f for f in files if TEST_DIR_RE.search(f)]
        if not tests:
            tests = [f for f in files if TEST_FILE_RE.search(f)]
        src = [f for f in files if f not in tests]
        if not tests or len(src) < min_src:
            continue
        new_defs = new_tests = 0
        if min_new_defs or min_new_tests:
            patch = git(["show", "--format=", c, "--"] + src + tests, repo_dir)
            new_defs = sum(
                1 for ln in patch.splitlines() if ln.startswith(("+def ", "+    def "))
            )
            new_tests = sum(
                1 for ln in patch.splitlines() if re.match(r"^\+\s*def test_", ln)
            )
            if new_defs < min_new_defs or new_tests < min_new_tests:
                continue
        out.append(
            {
                "commit": c,
                "date": date.get(c, ""),
                "subject": subj,
                "files": files,
                "tests": tests,
                "src": src,
                "added": add,
                "deleted": dele,
                "lines": total,
                "src_files": len(src),
                "test_files_n": len(tests),
                "new_defs": new_defs,
                "new_tests": new_tests,
                "score": total + 60 * (len(src) - 1) + 30 * (len(tests) - 1),
            }
        )
    out.sort(key=lambda x: -x["score"])
    return out


def run_tests(repo, wt, test_files, tag, tid):
    py = f"{ROOT}/venvs/{repo}/bin/python"
    src = os.path.join(wt, "src")
    pp = src if os.path.isdir(src) else wt
    env = os.environ.copy()
    env["PYTHONPATH"] = pp
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    for k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
        env.pop(k, None)
    env["NO_PROXY"] = "127.0.0.1,localhost"
    out = f"{ROOT}/results/val2-{tid}-{tag}.xml"
    cmd = [
        py,
        "-m",
        "pytest",
        "-q",
        "--tb=no",
        "-p",
        "no:cacheprovider",
        f"--junitxml={out}",
    ]
    r = sh(cmd + test_files, cwd=wt, env=env)
    passed = failed = 0
    if os.path.exists(out):
        for tc in ET.parse(out).getroot().iter("testcase"):
            bad = tc.find("failure") is not None or tc.find("error") is not None
            passed += not bad
            failed += bad
        os.remove(out)
    return {
        "exit": r.returncode,
        "passed": passed,
        "failed": failed,
        "tail": (r.stdout or r.stderr or "")[-300:],
    }


def validate(c):
    repo, commit = c["repo"], c["commit"]
    tid = f"{repo}-{commit[:7]}"
    repo_dir = f"{ROOT}/repos/{repo}"
    base_wt = f"{ROOT}/worktrees/m2-{tid}-base"
    fix_wt = f"{ROOT}/worktrees/m2-{tid}-fix"
    for p in (base_wt, fix_wt):
        sh(["git", "worktree", "remove", "--force", p], cwd=repo_dir)
        shutil.rmtree(p, ignore_errors=True)
    if sh(
        ["git", "worktree", "add", "--detach", base_wt, f"{commit}^"], cwd=repo_dir
    ).returncode:
        return None
    if sh(
        ["git", "worktree", "add", "--detach", fix_wt, commit], cwd=repo_dir
    ).returncode:
        return None
    patch = git(["diff", f"{commit}^", commit, "--"] + c["tests"], repo_dir)
    ap = subprocess.run(
        ["git", "apply", "-"],
        check=False,
        cwd=base_wt,
        text=True,
        input=patch,
        capture_output=True,
    )
    if ap.returncode != 0:
        return {**c, "id": tid, "valid": False, "why": "test patch conflict"}
    base = run_tests(repo, base_wt, c["tests"], "base", tid)
    fix = run_tests(repo, fix_wt, c["tests"], "fix", tid)
    ok = (
        base["failed"] > 0
        and fix["exit"] == 0
        and fix["failed"] == 0
        and fix["passed"] > 0
    )
    why = (
        ""
        if ok
        else f"base f{base['failed']}/p{base['passed']} fix f{fix['failed']}/e{fix['exit']}"
    )
    return {
        **c,
        "id": tid,
        "test_files": c["tests"],
        "base": base,
        "fix": fix,
        "valid": ok,
        "why": why,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--since", default="2022-01-01")
    ap.add_argument("--min-src", type=int, default=2)
    ap.add_argument("--min-lines", type=int, default=40)
    ap.add_argument("--max-lines", type=int, default=300)
    ap.add_argument("--cap", type=int, default=16)
    ap.add_argument("--limit", type=int, default=2000)
    ap.add_argument(
        "--min-new-defs", type=int, default=0, help="new module-level defs in src"
    )
    ap.add_argument(
        "--min-new-tests", type=int, default=0, help="new test functions added"
    )
    ap.add_argument("--out", default=f"{ROOT}/tasks.mine2.json")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    repo_dir = f"{ROOT}/repos/{a.repo}"
    cands = discover(
        repo_dir,
        a.since,
        a.min_src,
        a.min_lines,
        a.max_lines,
        a.limit,
        a.min_new_defs,
        a.min_new_tests,
    )
    print(f"discovered {len(cands)} candidates for {a.repo}", file=sys.stderr)
    for c in cands:
        c["repo"] = a.repo
    picked, seen = [], set()
    for c in cands:
        key = c["subject"]
        if key in seen:
            continue
        seen.add(key)
        picked.append(c)
        if len(picked) >= a.cap:
            break
    if a.dry_run:
        for c in picked:
            print(
                f"{c['score']:5d} {c['lines']:3d}L src={c['src_files']} t={c['test_files_n']} {c['date']} {c['subject'][:70]}"
            )
        return
    os.makedirs(f"{ROOT}/results", exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as ex:
        results = [r for r in ex.map(validate, picked) if r]
    valid = sorted([r for r in results if r["valid"]], key=lambda x: -x["score"])
    old = []
    if os.path.exists(a.out) and os.path.getsize(a.out) > 2:
        with open(a.out) as fh:
            old = json.load(fh)
    merged = {x["id"]: x for x in old + valid}
    with open(a.out, "w") as fh:
        json.dump(list(merged.values()), fh, indent=2, ensure_ascii=False)
    for r in results:
        print(
            json.dumps(
                {
                    "id": r["id"],
                    "valid": r["valid"],
                    "lines": r["lines"],
                    "src": r["src_files"],
                    "base": [r["base"]["passed"], r["base"]["failed"]],
                    "fix": [r["fix"]["passed"], r["fix"]["failed"]],
                    "why": r["why"],
                },
                ensure_ascii=False,
            )
        )
    print(
        f"valid {len(valid)}/{len(results)} (pool now {len(merged)})", file=sys.stderr
    )


if __name__ == "__main__":
    main()
