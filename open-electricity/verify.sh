#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
unset VIRTUAL_ENV

# If not forced with --all / --force, skip when no Python files or configs have changed
if [[ "${1:-}" != "--all" && "${1:-}" != "--force" ]]; then
  CHANGED_PY=$(git status --porcelain -- . | grep -E '(\.py|pyproject\.toml|uv\.lock)$' || true)
  if [[ -z "$CHANGED_PY" ]]; then
    echo "⏭️  No Python changes detected in open-electricity; skipping verification. (Pass --all to force)"
    exit 0
  fi
fi

echo "🔍 Running open-electricity Python pre-commit verification..."

echo "1/4 Formatting (ruff format)..."
uv run ruff format

echo "2/4 Linting (ruff check)..."
uv run ruff check

echo "3/4 Type checking (ty check)..."
uv run ty check

echo "4/4 Testing (pytest)..."
uv run pytest

echo "✅ Verification passed!"
