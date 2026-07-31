#!/usr/bin/env python3
"""Validate the repository's portable skill contract using only stdlib."""

import re
import sys
from pathlib import Path


def validate_skill(raw_path):
    root = Path(raw_path)
    skill = root / "SKILL.md"
    metadata = root / "agents" / "openai.yaml"
    if not skill.is_file():
        return False, "SKILL.md not found"
    text = skill.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return False, "invalid YAML frontmatter boundary"
    fields = dict(
        item.groups()
        for line in match.group(1).splitlines()
        if (item := re.match(r"^([a-z-]+):\s*(.+)$", line))
    )
    name = fields.get("name", "")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
        return False, "name must be kebab-case"
    if root.name != name:
        return False, "directory name must match skill name"
    if not fields.get("description"):
        return False, "description is required"
    if not metadata.is_file():
        return False, "agents/openai.yaml not found"
    meta = metadata.read_text(encoding="utf-8")
    for token in ("display_name:", "short_description:", "default_prompt:"):
        if token not in meta:
            return False, f"agents/openai.yaml missing {token}"
    if f"${name}" not in meta:
        return False, "default_prompt must reference the skill"
    implicit_blocked = "allow_implicit_invocation: false" in meta
    user_invoked = fields.get("disable-model-invocation") == "true"
    if implicit_blocked != user_invoked:
        return False, "invocation mode mismatch"
    return True, "Skill is valid"


if __name__ == "__main__":
    ok, message = validate_skill(sys.argv[1] if len(sys.argv) == 2 else "")
    print(message)
    raise SystemExit(0 if ok else 1)
