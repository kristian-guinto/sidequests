# Workspace Agent Guidelines

## Python Code Verification (Run ONLY After Python Changes)
The verification pipeline must be executed **only after Python code changes are made**, as part of the final verification step:
1. Format: `uv run ruff format`
2. Lint: `uv run ruff check`
3. Type Check: `uv run ty check`
4. Test: `uv run pytest`

All tools must report 0 errors before changes are finalized.

### Intelligent Triggering Invariants:
- **NEVER run before making changes**: Do not run verification proactively before starting edits or to "check baseline state".
- **NEVER run during research, discovery, or planning**: Skip entirely while reading files, investigating bugs, exploring the codebase, or answering questions.
- **NEVER run for non-Python changes**: Skip entirely if changes only touch markdown/docs (`*.md`), frontend code (`*.ts`, `*.tsx`, `*.css`), or non-Python configuration.
- **Batch at task conclusion**: If editing multiple Python files, finish all edits first and run the verification pipeline once at the end.

For project domain invariants and energy market classification, see [.agents/rules/opennem-rules.md](.agents/rules/opennem-rules.md).
