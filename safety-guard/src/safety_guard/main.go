package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

// HookPayload maps Antigravity's PreToolUse invocation structure.
// Supports both camelCase (protojson standard) and snake_case / PascalCase variants.
type HookPayload struct {
	ToolName string                 `json:"tool_name"`
	ToolCall *ToolCall              `json:"toolCall"`
	Args     map[string]interface{} `json:"args"`
}

type ToolCall struct {
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args"`
}

// HookResponse defines the resolution output consumed by agy.
type HookResponse struct {
	Decision string `json:"decision"` // "allow" | "force_ask" | "deny"
	Reason   string `json:"reason"`
}

var (
	// Root binaries permitted to run fully unattended
	safeRootBinaries = map[string]bool{
		"pytest": true, "cargo": true, "npm": true, "pnpm": true, "yarn": true,
		"python": true, "python3": true, "node": true, "go": true, "uv": true,
		"ruff": true, "black": true, "mypy": true, "flake8": true,
		"eslint": true, "tsc": true, "cat": true, "ls": true,
		"pwd": true, "grep": true, "find": true, "head": true, "tail": true,
		"echo": true, "printf": true, "true": true, "false": true, "date": true,
		"which": true, "whereis": true, "mkdir": true, "touch": true,
	}

	// Read-only Git commands permitted without confirmation
	safeGitSubcommands = map[string]bool{
		"status": true, "diff": true, "log": true, "branch": true, "show": true,
	}

	// Destructive Git operations blocked outright
	dangerousGitPatterns = []*regexp.Regexp{
		regexp.MustCompile(`\breset\s+--hard\b`),
		regexp.MustCompile(`\bpush\s+.*--force\b`),
		regexp.MustCompile(`\bclean\s+.*-[a-zA-Z]*f\b`),
		regexp.MustCompile(`\bcheckout\s+--\s+\.`),
	}

	envFilePattern = regexp.MustCompile(`(^|/)\.env(\.[a-zA-Z0-9_-]+)?$`)
)

func sendResponse(decision, reason string) {
	out, _ := json.Marshal(HookResponse{
		Decision: decision,
		Reason:   reason,
	})
	fmt.Println(string(out))
	os.Exit(0)
}

func main() {
	// Read payload from stdin
	rawInput, err := io.ReadAll(os.Stdin)
	if err != nil || len(strings.TrimSpace(string(rawInput))) == 0 {
		// Fail-closed on missing payload
		os.Exit(1)
	}

	var payload HookPayload
	if err := json.Unmarshal(rawInput, &payload); err != nil {
		os.Exit(1)
	}

	toolName := payload.ToolName
	args := payload.Args
	if payload.ToolCall != nil {
		if payload.ToolCall.Name != "" {
			toolName = payload.ToolCall.Name
		}
		if payload.ToolCall.Args != nil {
			args = payload.ToolCall.Args
		}
	}

	// Pass non-command tools through to standard permissions
	if toolName != "run_command" {
		sendResponse("allow", "Non-command tool bypasses shell guard")
		return
	}

	// Extract command string
	var cmdLine string
	if args != nil {
		if val, ok := args["CommandLine"].(string); ok && val != "" {
			cmdLine = val
		} else if val, ok := args["commandLine"].(string); ok && val != "" {
			cmdLine = val
		} else if val, ok := args["command"].(string); ok && val != "" {
			cmdLine = val
		}
	}

	if strings.TrimSpace(cmdLine) == "" {
		sendResponse("allow", "Empty command string")
		return
	}

	// Parse shell script into full POSIX AST
	parser := syntax.NewParser()
	file, err := parser.Parse(strings.NewReader(cmdLine), "")
	if err != nil {
		// Malformed or deliberately obfuscated syntax escalates to manual review
		sendResponse("force_ask", fmt.Sprintf("Unparseable shell syntax: %v", err))
		return
	}

	overallDecision := "allow"
	overallReason := "All AST nodes verified safe."

	// Check if any node in the whole command references .env files
	hasEnvReference := false
	var envRefTarget string

	// Walk every AST node recursively
	syntax.Walk(file, func(node syntax.Node) bool {
		switch x := node.(type) {

		// 1. Inspect file redirects: e.g., > .env, < .env, >> secret.env
		case *syntax.Redirect:
			if x.Word != nil {
				target := extractWordText(x.Word)
				if isEnvFileTarget(target) {
					hasEnvReference = true
					envRefTarget = target
					sendResponse("deny", fmt.Sprintf("Blocked redirect targeting sensitive file: %s", target))
					return false
				}
			}

		// 2. Inspect words for sensitive env patterns everywhere
		case *syntax.Word:
			target := extractWordText(x)
			if isEnvFileTarget(target) {
				hasEnvReference = true
				envRefTarget = target
				sendResponse("deny", fmt.Sprintf("Access to environment secret blocked: %s", target))
				return false
			}

		// 3. Inspect individual commands and arguments
		case *syntax.CallExpr:
			if len(x.Args) == 0 {
				return true
			}

			cmdBinary := filepath.Base(extractLiteralWord(x.Args[0]))
			fullCallStr := nodeToString(x)

			// Hard Deny: Sudo / Su
			if cmdBinary == "sudo" || cmdBinary == "su" {
				sendResponse("deny", "Privilege escalation (sudo/su) is strictly forbidden")
				return false
			}

			// Destructive primitives: dd, mkfs
			if cmdBinary == "dd" || strings.HasPrefix(cmdBinary, "mkfs") {
				sendResponse("deny", fmt.Sprintf("Destructive system primitive blocked: %s", cmdBinary))
				return false
			}

			// Removal checks
			if cmdBinary == "rm" {
				isRecursive := false
				isForce := false
				for _, argNode := range x.Args[1:] {
					arg := extractLiteralWord(argNode)
					if strings.HasPrefix(arg, "-") && !strings.HasPrefix(arg, "--") {
						if strings.Contains(arg, "r") || strings.Contains(arg, "R") {
							isRecursive = true
						}
						if strings.Contains(arg, "f") {
							isForce = true
						}
					}
					if arg == "--recursive" {
						isRecursive = true
					}
					if arg == "--force" {
						isForce = true
					}
				}
				if isRecursive && isForce {
					sendResponse("deny", "Destructive recursive removal (rm -rf) is blocked")
					return false
				}
				// Standalone safe remove escalates to manual confirmation
				if overallDecision != "deny" {
					overallDecision = "force_ask"
					overallReason = "File removal operation requires confirmation"
				}
				return true
			}

			// Git Command Evaluation
			if cmdBinary == "git" {
				for _, pattern := range dangerousGitPatterns {
					if pattern.MatchString(fullCallStr) {
						sendResponse("deny", fmt.Sprintf("Dangerous Git command detected: %s", fullCallStr))
						return false
					}
				}

				if len(x.Args) > 1 {
					subCmd := extractLiteralWord(x.Args[1])
					if !safeGitSubcommands[subCmd] && overallDecision != "deny" {
						overallDecision = "force_ask"
						overallReason = fmt.Sprintf("Git operation requires confirmation: git %s", subCmd)
					}
				}
				return true
			}

			// Pipeline download & execution (curl ... | bash)
			if cmdBinary == "curl" || cmdBinary == "wget" {
				if overallDecision != "deny" {
					overallDecision = "force_ask"
					overallReason = "Network fetch tool requires confirmation"
				}
				return true
			}

			// Package installations (pip, pip3, npm, pnpm)
			if (cmdBinary == "pip" || cmdBinary == "pip3" || cmdBinary == "npm" || cmdBinary == "pnpm") && len(x.Args) > 1 {
				sub := extractLiteralWord(x.Args[1])
				if sub == "install" || sub == "i" || sub == "add" {
					if overallDecision != "deny" {
						overallDecision = "force_ask"
						overallReason = fmt.Sprintf("Dependency installation requires confirmation: %s %s", cmdBinary, sub)
					}
					return true
				}
			}

			// Whitelist check for other binaries
			if !safeRootBinaries[cmdBinary] {
				if overallDecision != "deny" {
					overallDecision = "force_ask"
					overallReason = fmt.Sprintf("Unrecognized binary outside whitelist: %s", cmdBinary)
				}
			}
		}
		return true
	})

	if hasEnvReference {
		sendResponse("deny", fmt.Sprintf("Access to environment secret blocked: %s", envRefTarget))
		return
	}

	sendResponse(overallDecision, overallReason)
}

func isEnvFileTarget(s string) bool {
	clean := strings.Trim(s, `"'`)
	if envFilePattern.MatchString(filepath.Base(clean)) {
		return true
	}
	// Check inside raw quotes or embedded scripts like open('.env') or cat .env*
	if strings.Contains(clean, ".env") {
		// Look for .env token or .env.<name>
		subparts := strings.FieldsFunc(clean, func(r rune) bool {
			return r == '\'' || r == '"' || r == ' ' || r == '/' || r == '(' || r == ')' || r == ','
		})
		for _, part := range subparts {
			if envFilePattern.MatchString(part) {
				return true
			}
		}
	}
	return false
}

func extractLiteralWord(w *syntax.Word) string {
	var sb strings.Builder
	for _, part := range w.Parts {
		if lit, ok := part.(*syntax.Lit); ok {
			sb.WriteString(lit.Value)
		}
	}
	return sb.String()
}

func extractWordText(w *syntax.Word) string {
	var sb strings.Builder
	for _, part := range w.Parts {
		switch p := part.(type) {
		case *syntax.Lit:
			sb.WriteString(p.Value)
		case *syntax.SglQuoted:
			sb.WriteString(p.Value)
		case *syntax.DblQuoted:
			for _, qp := range p.Parts {
				if lit, ok := qp.(*syntax.Lit); ok {
					sb.WriteString(lit.Value)
				}
			}
		}
	}
	return sb.String()
}

func nodeToString(node syntax.Node) string {
	var sb strings.Builder
	syntax.NewPrinter().Print(&sb, node)
	return sb.String()
}
