#!/usr/bin/env python3
"""Validate benchmark tasks: base commit + test patch must fail; fix commit must pass."""
import json, os, shutil, subprocess, sys, xml.etree.ElementTree as ET

ROOT = "/tmp/cew-eval"
TASKS = [
    {"id": "slugify-200", "repo": "python-slugify", "commit": "8f9a550",
     "issue": "Avoid trailing post-replacement delimiters in modern hard cuts (#200)"},
    {"id": "slugify-194", "repo": "python-slugify", "commit": "2f23599",
     "issue": "Fix add_uppercase_char to leave input unchanged on error (#194)"},
    {"id": "humanize-346", "repo": "humanize", "commit": "ca892b3",
     "issue": "Fix intword() rounding carry for very large numbers (#346)"},
    {"id": "humanize-381", "repo": "humanize", "commit": "ffdf407",
     "issue": "Support general iterables in natural_list (#381)"},
    {"id": "more-itertools-1284", "repo": "more-itertools", "commit": "2b8d5cd",
     "issue": "Issue 1284: don't let a bucket lookup invent a key"},
    {"id": "itsdangerous-sha1", "repo": "itsdangerous", "commit": "7f4dcf8",
     "issue": "access sha1 lazily"},
]


def sh(args, cwd=None, check=False, env=None):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=check, env=env)


def worktree(repo_dir, rev, dest):
    if os.path.exists(dest):
        sh(["git", "worktree", "remove", "--force", dest], cwd=repo_dir)
        shutil.rmtree(dest, ignore_errors=True)
    r = sh(["git", "worktree", "add", "--detach", dest, rev], cwd=repo_dir)
    if r.returncode != 0:
        raise RuntimeError(f"worktree failed: {r.stderr}")
    return dest


def run_tests(task, wt, venv, tag):
    py = f"{ROOT}/venvs/{venv}/bin/python"
    src = os.path.join(wt, "src")
    pp = src if os.path.isdir(src) else wt
    env = os.environ.copy()
    env["PYTHONPATH"] = pp
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env.pop("HTTP_PROXY", None)
    env["NO_PROXY"] = "127.0.0.1,localhost"
    out = f"{ROOT}/results/validate-{task['id']}-{tag}.xml"
    cmd = [py, "-m", "pytest", "-q", "--tb=no", "-p", "no:cacheprovider",
           f"--junitxml={out}"] + task["test_files"]
    r = sh(cmd, cwd=wt, env=env)
    passed = failed = 0
    names_failed = []
    if os.path.exists(out):
        root = ET.parse(out).getroot()
        for tc in root.iter("testcase"):
            bad = tc.find("failure") is not None or tc.find("error") is not None
            if bad:
                failed += 1
                names_failed.append(tc.get("name"))
            else:
                passed += 1
    return {"tag": tag, "exit": r.returncode, "passed": passed, "failed": failed,
            "failed_names": names_failed[:8], "tail": (r.stdout or "")[-400:]}


def main():
    os.makedirs(f"{ROOT}/results", exist_ok=True)
    os.makedirs(f"{ROOT}/worktrees", exist_ok=True)
    out = []
    for t in TASKS:
        repo_dir = f"{ROOT}/repos/{t['repo']}"
        repo = t["repo"]
        # test files touched by the fix commit
        r = sh(["git", "show", "--numstat", "--format=", t["commit"]], cwd=repo_dir, check=True)
        files = [ln.split("\t")[-1] for ln in r.stdout.strip().splitlines() if ln.strip()]
        tests = [f for f in files if "test" in f]
        t["test_files"] = tests
        base_wt = f"{ROOT}/worktrees/{t['id']}-base"
        fix_wt = f"{ROOT}/worktrees/{t['id']}-fix"
        worktree(repo_dir, t["commit"] + "^", base_wt)
        worktree(repo_dir, t["commit"], fix_wt)
        patch = sh(["git", "diff", f"{t['commit']}^", t["commit"], "--"] + tests, cwd=repo_dir, check=True).stdout
        ap = subprocess.run(["git", "apply", "-"], cwd=base_wt, text=True,
                            input=patch, capture_output=True)
        if ap.returncode != 0:
            raise RuntimeError(f"test patch failed for {t['id']}: {ap.stderr}")
        base_res = run_tests(t, base_wt, repo, "base")
        fix_res = run_tests(t, fix_wt, repo, "fix")
        ok = base_res["failed"] > 0 and fix_res["exit"] == 0
        t.update({"base": base_res, "fix": fix_res, "valid": ok})
        out.append(t)
        print(json.dumps({"id": t["id"], "valid": ok, "base": [base_res["passed"], base_res["failed"]],
                          "fix": [fix_res["passed"], fix_res["failed"]], "fix_exit": fix_res["exit"]},
                         ensure_ascii=False))
    json.dump(out, open(f"{ROOT}/tasks.validated.json", "w"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
