#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOME_DIR="${HOME:?HOME is required}"

INSTALL_CLAUDE=1
INSTALL_CODEX=1
DRY_RUN=0

usage() {
    cat <<'EOF'
Usage: scripts/install.sh [options]

Options:
  --claude-only   Only install to ~/.claude
  --codex-only    Only install to ~/.codex
  --dry-run       Print operations without writing files
  -h, --help      Show this help
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --claude-only)
            INSTALL_CLAUDE=1
            INSTALL_CODEX=0
            ;;
        --codex-only)
            INSTALL_CLAUDE=0
            INSTALL_CODEX=1
            ;;
        --dry-run)
            DRY_RUN=1
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

run() {
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '[dry-run] %q' "$1"
        shift
        for arg in "$@"; do
            printf ' %q' "$arg"
        done
        printf '\n'
    else
        "$@"
    fi
}

backup_if_changed() {
    local src="$1"
    local dest="$2"

    if [ ! -f "$dest" ] || cmp -s "$src" "$dest"; then
        return
    fi

    local backup="${dest}.bak.$(date +%Y%m%d%H%M%S)"
    echo "Backup: $dest -> $backup"
    run cp "$dest" "$backup"
}

copy_file() {
    local src="$1"
    local dest="$2"

    backup_if_changed "$src" "$dest"
    run cp "$src" "$dest"
}

copy_claude_settings() {
    local src="$1"
    local dest="$2"

    backup_if_changed "$src" "$dest"
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "[dry-run] merge '$src' into '$dest' preserving existing env and mcpServers"
        echo "[dry-run] purge legacy hook paths while merging Claude settings"
        return
    fi

    node "$ROOT_DIR/scripts/merge-claude-settings.cjs" "$src" "$dest"
    chmod 600 "$dest"
}

copy_dir() {
    local name="$1"
    local dest_root="$2"

    if [ ! -d "$ROOT_DIR/$name" ]; then
        return
    fi

    if [ -L "$dest_root/$name" ]; then
        echo "Refusing to merge into symlinked destination: $dest_root/$name" >&2
        exit 1
    fi

    run mkdir -p "$dest_root/$name"
    run rsync -a "$ROOT_DIR/$name/" "$dest_root/$name/"
}

require_rsync() {
    if [ "$DRY_RUN" -eq 1 ]; then
        return
    fi

    if ! command -v rsync >/dev/null 2>&1; then
        echo "rsync is required. Please install rsync and retry." >&2
        exit 1
    fi
}

install_shared_dirs() {
    local dest="$1"

    copy_dir rules "$dest"
    copy_dir agents "$dest"
    copy_dir commands "$dest"
    copy_dir scripts "$dest"
    copy_dir hooks "$dest"
    copy_dir skills "$dest"
    copy_dir references "$dest"
    copy_dir harness "$dest"
}

remove_package_only_paths() {
    local dest="$1"

    for file in \
        "scripts/install.sh" \
        "scripts/install.ps1" \
        "scripts/verify-harness.js" \
        "scripts/verify/core.js" \
        "scripts/verify/grilling-spec-gate-checks.js" \
        "scripts/verify/metadata-checks.js" \
        "scripts/verify/repository-checks.js" \
        "scripts/verify/runtime-checks.js" \
        "scripts/verify/workflow-checks.js" \
        "scripts/verify/workflow-ownership-fixtures.js" \
        "scripts/verify/workflow-ownership.js" \
        "scripts/verify/skill-manifest-checks.js" \
        "scripts/verify/skill-manifest-checks.test.js"
    do
        if [ -f "$dest/$file" ]; then
            run rm -f "$dest/$file"
        fi
    done

    if [ -d "$dest/scripts/verify" ] && [ -z "$(find "$dest/scripts/verify" -mindepth 1 -print -quit)" ]; then
        run rmdir "$dest/scripts/verify"
    fi
}

remove_obsolete_workflow_paths() {
    local dest="$1"
    local file
    local dir

    for file in \
        "commands/e2e.md" \
        "commands/evolve.md" \
        "commands/grill.md" \
        "commands/harness-audit.md" \
        "commands/instinct-status.md" \
        "commands/learn-eval.md" \
        "commands/projects.md" \
        "commands/promote.md" \
        "commands/prune.md" \
        "commands/setup-workflow.md" \
        "commands/tdd.md" \
        "scripts/hooks/run-with-flags.js" \
        "scripts/hooks/commit-quality.js" \
        "scripts/hooks/session-start.js" \
        "scripts/hooks/session-end.js" \
        "scripts/lib/hook-flags.js" \
        "scripts/lib/utils.js" \
        "hooks/review-confidence.js" \
        "hooks/session-start.js" \
        "hooks/session-end.js" \
        "hooks/evaluate-session.js" \
        "hooks/pre-compact.js" \
        "hooks/runtime/session-utils.js" \
        "rules/08-ecc-integration.md" \
        "skills/subagent-driven-development/implementer-prompt.md" \
        "skills/subagent-driven-development/task-reviewer-prompt.md" \
        "skills/subagent-driven-development/scripts/sdd-workspace" \
        "skills/subagent-driven-development/scripts/task-brief" \
        "skills/subagent-driven-development/scripts/review-package"
    do
        if [ -f "$dest/$file" ]; then
            run rm -f "$dest/$file"
        fi
    done

    for dir in "scripts/hooks" "scripts/lib" "skills/subagent-driven-development/scripts"; do
        if [ -d "$dest/$dir" ] && [ -z "$(find "$dest/$dir" -mindepth 1 -print -quit)" ]; then
            run rmdir "$dest/$dir"
        fi
    done
}

cleanup_retired_skills() {
    local dest="$1"

    if [ "$DRY_RUN" -eq 1 ]; then
        node "$ROOT_DIR/scripts/cleanup-retired-skills.js" "$dest" --dry-run
        return
    fi

    node "$ROOT_DIR/scripts/cleanup-retired-skills.js" "$dest"
}

validate_retired_skill_manifest() {
    node "$ROOT_DIR/scripts/cleanup-retired-skills.js" --validate
}

install_claude() {
    local dest="$HOME_DIR/.claude"

    echo "Installing Claude workflow to $dest"
    run mkdir -p "$dest"
    remove_obsolete_workflow_paths "$dest"
    copy_file "$ROOT_DIR/CLAUDE.md" "$dest/CLAUDE.md"
    copy_file "$ROOT_DIR/AGENTS.md" "$dest/AGENTS.md"
    copy_claude_settings "$ROOT_DIR/settings.json" "$dest/settings.json"
    install_shared_dirs "$dest"
    cleanup_retired_skills "$dest"
    remove_package_only_paths "$dest"
}

install_codex() {
    local dest="$HOME_DIR/.codex"

    echo "Installing Codex workflow to $dest"
    run mkdir -p "$dest"
    remove_obsolete_workflow_paths "$dest"
    copy_file "$ROOT_DIR/AGENTS.md" "$dest/AGENTS.md"
    install_shared_dirs "$dest"
    cleanup_retired_skills "$dest"
    remove_package_only_paths "$dest"
}

validate_retired_skill_manifest
require_rsync

if [ "$INSTALL_CLAUDE" -eq 1 ]; then
    install_claude
fi

if [ "$INSTALL_CODEX" -eq 1 ]; then
    install_codex
fi

echo "Install complete."
