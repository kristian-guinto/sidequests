# safety-guard

A compiled, sub-2ms safety interceptor for Google Antigravity CLI (`agy`) written in Go.

It hooks into Antigravity's `PreToolUse` lifecycle event, parses shell commands into a POSIX Abstract Syntax Tree (AST) using [`mvdan/sh`](https://github.com/mvdan/sh), and enforces security boundaries before commands execute.

---

## What It Does

| Action | Commands & AST Nodes | Resolution |
| :--- | :--- | :--- |
| **Safe Dev Tooling** | `pytest`, `cargo`, `npm`, `node`, `python`, `go`, `ruff`, `black`, `git status`, `git diff` | `"allow"` (runs unattended) |
| **Destructive Primitives** | `rm -rf`, `git reset --hard`, `git push --force`, `sudo`, `su`, `dd`, `mkfs` | `"deny"` (blocked fail-closed) |
| **Secret Protection** | Any token or redirect referencing `.env*` (e.g. `> .env`, `cat .env`) | `"deny"` (blocked fail-closed) |
| **Ambiguous / Network** | `pip install`, `npm i`, standalone `rm`, `curl`, `wget`, unlisted binaries | `"force_ask"` (prompts user) |

Because it parses the shell AST, chained evasions (e.g., `pytest && rm -rf /`) and obfuscated secret accesses are intercepted.

---

## Project Structure

```text
safety-guard/
├── build.sh               # Compiles static binary to bin/safety_guard
├── test.py                # Test suite covering AST decisions and fail-closed checks
├── hooks.json.example     # Reference Antigravity PreToolUse hook configuration
├── src/safety_guard/      # Go source (main.go, go.mod, go.sum)
└── bin/                   # Build output (gitignored)
```

---

## Setup & Installation

### 1. Requirements
- Go 1.22+ (Linux, macOS, or Windows)
- Python 3 (for running test suite)

### 2. Build the Static Binary
```bash
./build.sh
```
This produces a static, stripped binary at `bin/safety_guard` (~2.1MB, ~1.5ms execution latency).

### 3. Run Tests
```bash
./test.py
```

### 4. Configure Antigravity Hook
Add the hook to your project's `.agents/hooks.json` (or globally at `~/.gemini/config/hooks.json`):

```json
{
  "go-auto-mode-safety-guard": {
    "enabled": true,
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/safety-guard/bin/safety_guard"
          }
        ]
      }
    ]
  }
}
```

Antigravity will now pass every `run_command` invocation through `safety_guard` before execution.
