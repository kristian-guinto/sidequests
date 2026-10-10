#!/usr/bin/env python3
import json
import subprocess
import sys

binary = sys.argv[1] if len(sys.argv) > 1 else "./bin/safety_guard"

tests = [
    ("1. Safe dev tool (pytest)", {"tool_name": "run_command", "args": {"CommandLine": "pytest tests/test_core.py"}}, "allow"),
    ("2. Chained destructive (pytest && rm -rf /)", {"tool_name": "run_command", "args": {"CommandLine": "pytest && rm -rf /"}}, "deny"),
    ("3. Secret access (.env literal)", {"tool_name": "run_command", "args": {"CommandLine": "python3 -c \"print(open('.env').read())\""}}, "deny"),
    ("4. Secret redirect (>> .env.production)", {"tool_name": "run_command", "args": {"CommandLine": "echo evil >> .env.production"}}, "deny"),
    ("5. Dangerous Git (git reset --hard)", {"tool_name": "run_command", "args": {"CommandLine": "git reset --hard HEAD~1"}}, "deny"),
    ("6. Safe Git (git status)", {"tool_name": "run_command", "args": {"CommandLine": "git status"}}, "allow"),
    ("7. Package install (pip install)", {"tool_name": "run_command", "args": {"CommandLine": "pip install pandas"}}, "force_ask"),
    ("8. Privilege escalation (sudo)", {"tool_name": "run_command", "args": {"CommandLine": "sudo apt update"}}, "deny"),
    ("9. Standalone rm", {"tool_name": "run_command", "args": {"CommandLine": "rm file.txt"}}, "force_ask"),
    ("10. Protojson format", {"toolCall": {"name": "run_command", "args": {"CommandLine": "pytest"}}}, "allow"),
    ("11. Non-command tool", {"tool_name": "view_file", "args": {"AbsolutePath": "/root/main.go"}}, "allow"),
]

failed = False
for name, payload, expected in tests:
    res = subprocess.run([binary], input=json.dumps(payload), capture_output=True, text=True)
    if res.returncode != 0:
        print(f"FAIL (exit {res.returncode}): {name} - stderr: {res.stderr}")
        failed = True
        continue
    data = json.loads(res.stdout)
    if data.get("decision") != expected:
        print(f"FAIL: {name} -> expected {expected}, got {data.get('decision')} ({data.get('reason')})")
        failed = True
    else:
        print(f"PASS: {name} -> {data.get('decision')}")

# Test fail-closed on invalid input
res_empty = subprocess.run([binary], input="", capture_output=True, text=True)
res_invalid = subprocess.run([binary], input="bad-json", capture_output=True, text=True)
if res_empty.returncode == 1 and res_invalid.returncode == 1:
    print("PASS: 12. Fail-closed on invalid input")
else:
    print(f"FAIL: Fail-closed (empty={res_empty.returncode}, invalid={res_invalid.returncode})")
    failed = True

if failed:
    sys.exit(1)
print("\nAll tests passed successfully!")
