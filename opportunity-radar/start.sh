#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
pkill -f "python3.*opportunity-radar/server.py" 2>/dev/null || true
sleep 0.5
setsid nohup python3 "${DIR}/server.py" > /tmp/opportunity-radar.log 2>&1 < /dev/null &
echo "Opportunity Radar running on port 3000"
