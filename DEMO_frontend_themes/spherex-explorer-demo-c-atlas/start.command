#!/bin/sh
# Double-click to start SPHEREx Explorer on macOS (or run ./start.command).
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 start.py "$@"
else
  exec python start.py "$@"
fi
