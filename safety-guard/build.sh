#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${SCRIPT_DIR}/src/safety_guard"
BIN_DIR="${SCRIPT_DIR}/bin"

mkdir -p "${BIN_DIR}"

echo "Building safety_guard binary..."
cd "${SRC_DIR}"
GOTOOLCHAIN=local go mod tidy
CGO_ENABLED=0 go build -ldflags="-s -w" -o "${BIN_DIR}/safety_guard" main.go

chmod +x "${BIN_DIR}/safety_guard"
echo "Build complete: ${BIN_DIR}/safety_guard"
