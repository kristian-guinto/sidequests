# Workspace Agent Guidelines

## Python Code Verification Invariant
For every change touching Python files:
1. Format: `uv run ruff format`
2. Lint: `uv run ruff check`
3. Type Check: `uv run ty check`
4. Test: `uv run pytest`

All tools must report 0 errors before changes are finalized.

For project domain invariants and energy market classification, see [.agents/rules/opennem-rules.md](.agents/rules/opennem-rules.md).
