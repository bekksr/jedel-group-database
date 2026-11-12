#!/usr/bin/env bash
set -eu
task_root="$(cd "$(dirname "$0")/.." && pwd)"
command -v python3.13 >/dev/null 2>&1 || { echo 'Install Python 3.13 (brew install python@3.13), then retry.' >&2; exit 1; }
exec python3.13 "$task_root/scripts/setup.py" "$@"
