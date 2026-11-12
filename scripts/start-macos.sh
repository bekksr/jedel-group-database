#!/usr/bin/env bash
set -eu
task_root="$(cd "$(dirname "$0")/.." && pwd)"
[ -x "$task_root/backend/.venv/bin/python" ] || { echo 'Run bash scripts/setup-macos.sh first.' >&2; exit 1; }
exec "$task_root/backend/.venv/bin/python" "$task_root/scripts/start.py"
