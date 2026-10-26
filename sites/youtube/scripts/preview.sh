#!/usr/bin/env bash
# Starts the OpenTube preview: dependencies, page build, then the static server.
#
# Safe to re-run any time. It reacts to the two things that actually break a
# fresh sandbox:
#   1. node_modules is not part of the snapshot  -> reinstalls jsdom (dev only)
#   2. the generated *.html can be stale          -> dev-server.mjs rebuilds on boot
#
# Usage:
#   ./scripts/preview.sh          # port 4321
#   PORT=4400 ./scripts/preview.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-${1:-4321}}"
cd "$ROOT"

command -v node >/dev/null || { echo "node is required" >&2; exit 1; }

if [ ! -d node_modules/jsdom ]; then
  echo "→ installing dev dependencies (jsdom)…"
  npm install --silent --no-fund --no-audit
fi

# Fail fast if the port is already serving this app rather than stacking servers.
if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/index.html"; then
  echo "→ something is already serving on port ${PORT}; leaving it alone"
  echo "  (stop it first, or choose another port: PORT=4400 ./scripts/preview.sh)"
  exit 0
fi

echo "→ building pages and starting OpenTube on port ${PORT}"
exec node dev-server.mjs "${PORT}"
