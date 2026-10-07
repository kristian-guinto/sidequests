#!/usr/bin/env bash
set -e

# Determine project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Clean up background processes on Ctrl+C or exit
cleanup() {
  echo ""
  echo "🛑 Stopping OpenElectricity development servers..."
  # Terminate all background child processes started by this script
  kill $(jobs -p) 2>/dev/null || true
  wait $(jobs -p) 2>/dev/null || true
  echo "✅ All servers stopped."
}
trap cleanup EXIT INT TERM

# Detect Python / FastAPI runner
if command -v uv >/dev/null 2>&1; then
  FASTAPI_CMD="uv run uvicorn api.index:app --port 8000 --reload"
elif [ -x "$SCRIPT_DIR/.venv/bin/uvicorn" ]; then
  FASTAPI_CMD="$SCRIPT_DIR/.venv/bin/uvicorn api.index:app --port 8000 --reload"
elif [ -x "$HOME/.cargo/bin/uv" ]; then
  FASTAPI_CMD="$HOME/.cargo/bin/uv run uvicorn api.index:app --port 8000 --reload"
elif [ -x "$HOME/.local/bin/uv" ]; then
  FASTAPI_CMD="$HOME/.local/bin/uv run uvicorn api.index:app --port 8000 --reload"
else
  FASTAPI_CMD="python3 -m uvicorn api.index:app --port 8000 --reload"
fi

echo "========================================================"
echo "⚡ Starting OpenElectricity Local Development Services"
echo "========================================================"
echo "🔌 FastAPI Backend  : http://localhost:8000 (docs: http://localhost:8000/api/docs)"
echo "💻 Next.js Frontend : http://localhost:3000"
echo "========================================================"

# Start FastAPI in background
$FASTAPI_CMD &

# Small pause to allow FastAPI to bind to port 8000
sleep 1

# Start Next.js frontend in foreground
npm run dev

