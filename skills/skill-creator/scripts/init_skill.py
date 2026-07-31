#!/usr/bin/env python3
"""Create a minimal self-contained skill skeleton."""

import argparse
import re
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("name")
    parser.add_argument("--path", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.name):
        parser.error("name must be kebab-case")

    target = Path(args.path).resolve() / args.name
    target.mkdir(parents=True, exist_ok=False)
    title = " ".join(part.title() for part in args.name.split("-"))
    (target / "SKILL.md").write_text(
        "---\n"
        f"name: {args.name}\n"
        "description: TODO：说明能力、触发条件与适用范围。\n"
        "---\n\n"
        f"# {title}\n\n"
        "## Workflow\n\n"
        "1. TODO\n\n"
        "## Verification\n\n"
        "- TODO\n",
        encoding="utf-8",
    )
    agents = target / "agents"
    agents.mkdir()
    (agents / "openai.yaml").write_text(
        "interface:\n"
        f'  display_name: "{title}"\n'
        '  short_description: "TODO"\n'
        f'  default_prompt: "使用 ${args.name} 完成当前任务。"\n',
        encoding="utf-8",
    )
    print(target)


if __name__ == "__main__":
    main()
