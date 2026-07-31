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

    local args=("$ROOT_DIR/scripts/merge-distribution.js" "$src" "$dest" "--file" "--backup-only")
    if [ "$DRY_RUN" -eq 1 ]; then
        args+=("--dry-run")
    fi
    node "${args[@]}"
}

copy_file() {
    local src="$1"
    local dest="$2"

    local args=("$ROOT_DIR/scripts/merge-distribution.js" "$src" "$dest" "--file")
    if [ "$DRY_RUN" -eq 1 ]; then
        args+=("--dry-run")
    fi
    node "${args[@]}"
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

    local args=("$ROOT_DIR/$name" "$dest_root/$name")
    if [ "$DRY_RUN" -eq 1 ]; then
        args+=("--dry-run")
    fi
    node "$ROOT_DIR/scripts/merge-distribution.js" "${args[@]}"
}

install_shared_dirs() {
    local dest="$1"

    copy_dir rules "$dest"
    copy_dir agents "$dest"
    copy_dir commands "$dest"
    copy_dir scripts "$dest"
    copy_dir hooks "$dest"
    copy_dir skills "$dest"
    copy_dir homunculus "$dest"
    copy_dir references "$dest"
}

remove_package_only_paths() {
    local dest="$1"

    for file in \
        "scripts/install.sh" \
        "scripts/install.ps1" \
        "scripts/verify-install.ps1"
    do
        if [ -f "$dest/$file" ]; then
            run rm -f "$dest/$file"
        fi
    done
}

remove_obsolete_workflow_paths() {
    local dest="$1"
    local file
    local dir

    for file in \
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
        "hooks/runtime/session-utils.js"
    do
        if [ -f "$dest/$file" ]; then
            run rm -f "$dest/$file"
        fi
    done

    for dir in "scripts/hooks" "scripts/lib"; do
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

prepare_retired_skills() {
    local dest="$1"

    if [ "$DRY_RUN" -eq 1 ]; then
        return
    fi
    node "$ROOT_DIR/scripts/cleanup-retired-skills.js" "$dest" --prepare
}

validate_retired_skill_manifest() {
    node "$ROOT_DIR/scripts/cleanup-retired-skills.js" --validate
}

preflight_install() {
    local dest="$1"

    node "$ROOT_DIR/scripts/preflight-install-paths.js" \
        "$ROOT_DIR" \
        "$dest" \
        "AGENTS.md" \
        "CLAUDE.md" \
        "settings.json" \
        "rules" \
        "agents" \
        "commands" \
        "scripts" \
        "hooks" \
        "skills" \
        "homunculus" \
        "references"
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

if [ "$INSTALL_CLAUDE" -eq 1 ]; then
    preflight_install "$HOME_DIR/.claude"
fi

if [ "$INSTALL_CODEX" -eq 1 ]; then
    preflight_install "$HOME_DIR/.codex"
fi

if [ "$INSTALL_CLAUDE" -eq 1 ]; then
    prepare_retired_skills "$HOME_DIR/.claude"
fi

if [ "$INSTALL_CODEX" -eq 1 ]; then
    prepare_retired_skills "$HOME_DIR/.codex"
fi

if [ "$INSTALL_CLAUDE" -eq 1 ]; then
    install_claude
fi

if [ "$INSTALL_CODEX" -eq 1 ]; then
    install_codex
fi

echo "Install complete."
