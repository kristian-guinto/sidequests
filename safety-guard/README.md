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

### 2. Build and Install Binary
Compile the static binary to `bin/safety_guard` and optionally install directly to `~/.local/bin`:
```bash
# Build only
./build.sh

# Build and install to ~/.local/bin/safety_guard
./build.sh --install
```
This produces a static, stripped binary (~2.1MB, ~1.5ms execution latency).

### 3. Run Tests
```bash
./test.py
```

### 4. Configure Antigravity Hook

#### Global Setup (Recommended - Machine-Wide)
To protect all projects and workspaces on your machine, configure the hook in `~/.gemini/config/hooks.json`:

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
            "command": "~/.local/bin/safety_guard"
          }
        ]
      }
    ]
  }
}
```

> **Why Global?** Antigravity discovers project-level hooks by searching `.agents/hooks.json` up to the repository root (`.git`). If `hooks.json` is placed outside a project's repository root without being in `~/.gemini/config/hooks.json`, it will not be loaded. Placing the configuration in `~/.gemini/config/hooks.json` ensures it applies across all repositories and subdirectories.

#### Project-Level Setup
Alternatively, check `hooks.json` into a specific repository at `.agents/hooks.json` (at the project's root) to version-control it with your team.

---

---

## Continuous Unattended Execution Architecture

To achieve a workflow where the agent **runs continuously on standard dev tasks without interruption** while **strictly halting or blocking dangerous actions**, Antigravity relies on three cooperating layers:

```
┌────────────────────────────────────────────────────────┐
│                   Tool Call Invoked                    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │  1. PreToolUse Hook       │
              │     (safety_guard AST)    │
              └─────────────┬─────────────┘
                            │
       ┌────────────────────┼─────────────────────┐
       ▼                    ▼                     ▼
┌──────────────┐    ┌──────────────┐      ┌──────────────┐
│    "deny"    │    │ "force_ask"  │      │   "allow"    │
└──────┬───────┘    └──────┬───────┘      └──────┬───────┘
       │                   │                     │
       ▼                   ▼                     ▼
  HARD BLOCKED       Forces Prompt         ┌──────────────┐
  (Fail-closed)     in request-review      │ 2. Perms     │
                    (curl, pip install,    │    Checker   │
                     rm file.txt)          └──────┬───────┘
                                                  │
                                 ┌────────────────┴────────────────┐
                                 ▼                                 ▼
                         In allow grants                    Not in grants
                         (git, python, pytest)             (Unlisted tool)
                                 │                                 │
                                 ▼                                 ▼
                           Auto-Proceeds                     Prompts User
                           (Uninterrupted)                   for Review
```

### 1. The Configuration Blueprint

#### A. Set Review Mode in `~/.gemini/antigravity-cli/settings.json`
```json
{
  "agentMode": "accept-edits",
  "toolPermission": "request-review",
  "artifactReviewPolicy": "always-proceed"
}
```
> **Note**: Setting `"toolPermission": "always-proceed"` auto-approves all tool confirmation prompts client-side (bypassing `force_ask`). Setting `"request-review"` ensures that when the safety hook or permission system flags an action for review, the CLI surfaces the interactive prompt to you.

#### B. Pre-Approve Safe Tool Prefixes in `~/.gemini/config/config.json`
Grant prefix permissions for standard safe developer tools so they execute without interactive prompts:

```json
{
  "userSettings": {
    "globalPermissionGrants": {
      "allow": [
        "command(python3)",
        "command(python)",
        "command(pytest)",
        "command(uv)",
        "command(git)",
        "command(cargo)",
        "command(npm)",
        "command(node)",
        "command(npx)",
        "command(go)",
        "command(ruff)",
        "command(black)",
        "command(cat)",
        "command(ls)",
        "command(grep)",
        "command(find)",
        "command(echo)",
        "command(mkdir)",
        "command(touch)"
      ]
    }
  }
}
```

#### C. Register Global Safety Hook in `~/.gemini/config/hooks.json`
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
            "command": "/root/.local/bin/safety_guard"
          }
        ]
      }
    ]
  }
}
```

---

### 2. How the 3-Tier Boundary Behaves

| Category | Example Commands | Security Action | User Experience |
| :--- | :--- | :--- | :--- |
| **Safe Developer Tools** | `pytest`, `uv run test`, `git status`, `git diff`, `python3 script.py`, `npm run build` | Verified by AST $\rightarrow$ `"allow"`; matched in prefix grants | **Executes continuously & unattended** with zero prompts. |
| **Ambiguous / Network Tools** | `curl`, `wget`, `pip install`, `npm i`, standalone `rm file.txt`, unlisted binaries | AST returns `"force_ask"`; not in prefix grants | **Halts execution and prompts user** in UI with rationale. |
| **Destructive Primitives** | `rm -rf`, `sudo`, `git reset --hard`, `git push --force`, `dd`, `mkfs` | AST returns `"deny"` | **Immediately hard-blocked fail-closed**; tool call aborted before running. |
| **Secrets & Credentials** | `cat .env`, `echo foo > .env.prod`, reading tokens | AST returns `"deny"` | **Immediately hard-blocked fail-closed**. |

