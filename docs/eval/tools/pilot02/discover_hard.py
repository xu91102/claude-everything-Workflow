#!/usr/bin/env python3
"""List harder candidate fix commits: source + tests, 25-400 lines, prefer multi-file."""
import subprocess, re, json, sys

TEST_DIR_RE = re.compile(r"(^|/)(tests?|testing)/")
TEST_FILE_RE = re.compile(r"(^|/)test_[^/]*\.py$|_test\.py$")
DOC_RE = re.compile(r"(^|/)(docs?|doc|README|CHANGELOG|CONTRIBUTING|\.github|news|changes)/|\.(md|rst|txt|toml|cfg|ini|yaml|yml)$")
TRIVIAL_RE = re.compile(r"^(release|bump|version|merge|chore|docs?|typo|lint|format)\b", re.I)


def run(args, cwd):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True).stdout


def main(repo_path, limit=4000, min_lines=25, max_lines=400):
    commits = run(["git", "log", "--no-merges", f"-n{limit}", "--format=%H"], repo_path).split()
    out = []
    for c in commits:
        subj = run(["git", "log", "-1", "--format=%s", c], repo_path).strip()
        if TRIVIAL_RE.search(subj):
            continue
        numstat = run(["git", "show", "--numstat", "--format=", c], repo_path).strip().splitlines()
        files, add, dele = [], 0, 0
        for line in numstat:
            parts = line.split("\t")
            if len(parts) != 3:
                continue
            a, d, f = parts
            if a == "-":
                continue
            files.append(f)
            add += int(a)
            dele += int(d)
        total = add + dele
        if not files or total > max_lines or total < min_lines:
            continue
        files = [f for f in files if not DOC_RE.search(f)]
        tests = [f for f in files if TEST_DIR_RE.search(f)]
        if not tests:
            tests = [f for f in files if TEST_FILE_RE.search(f)]
        src = [f for f in files if f not in tests]
        if not tests or not src:
            continue
        out.append({"commit": c, "subject": subj, "files": files, "tests": tests,
                    "src": src, "added": add, "deleted": dele, "lines": total,
                    "src_files": len(src), "score": total + 40 * (len(src) - 1)})
    out.sort(key=lambda x: -x["score"])
    print(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"# candidates: {len(out)}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 4000)
