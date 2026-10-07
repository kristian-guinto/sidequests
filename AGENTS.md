# Monorepo Workspace Guidelines (`sidequests`)

## 1. Vercel Monorepo Deployment Invariants
The `sidequests` repository houses multiple independent projects deployed to Vercel:
- `nem-battery` (root: `nem-battery`)
- `open-electricity` (root: `open-electricity`)
- `pollmph` (root: `pollmph/frontend`)

Whenever creating, modifying, or refactoring subprojects:
1. **Ignored Build Step**:
   - All projects must enforce build filtering to prevent cascading builds across unaffected projects.
   - Use the command: `git diff --quiet HEAD^ HEAD ./` (exit code `0` ignores/cancels build, `1` proceeds).
   - Ensure this is configured in both Vercel project settings (`commandForIgnoringBuildStep`) and `vercel.json` (`"ignoreCommand": "git diff --quiet HEAD^ HEAD ./"`).
2. **Root Directory Synchronization**:
   - If subproject directory layouts are moved, renamed, or hoisted, always verify and update the Vercel project's `rootDirectory` setting via the Vercel API or CLI before or immediately upon deployment.

---

## 2. Serverless FastAPI & DuckDB Backend Invariants
When implementing or maintaining Python serverless API handlers (`api/index.py`):
1. **Serverless DuckDB Extensions**:
   - The serverless environment has a read-only filesystem except `/tmp`.
   - Always initialize DuckDB connections with `extension_directory="/tmp/.duckdb/extensions"`.
2. **Direct Function Testability**:
   - Avoid using `Query(default=...)` for optional query parameters if endpoint functions are called directly in unit tests; prefer native type hints with defaults (e.g., `param: Optional[str] = None`) so direct function calls behave identically to HTTP queries.
3. **Timezone Representation**:
   - For NEM operational time series, maintain naive ISO timestamp strings (AEST) without UTC `Z` offsets to prevent client-side chart phase shifts.
