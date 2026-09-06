# Python Verification and Code Quality Standard

Whenever modifying or adding any Python files (`*.py`), the following verification pipeline MUST be run and must complete with zero errors and zero warnings:

1. **Format Code**:
   ```bash
   uv run ruff format
   ```
2. **Lint Code**:
   ```bash
   uv run ruff check
   ```
3. **Type Check**:
   ```bash
   uv run ty check
   ```

### Requirements:
- Do not consider any Python code modification complete until all three tools (`ruff format`, `ruff check`, and `ty check`) pass cleanly.
- Fix all formatting diffs, linter warnings/errors, and static typing diagnostics before completing your task.
- Run tests (`uv run pytest`) to ensure changes do not break existing behavior.
