#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -x .venv/bin/python ] || { echo 'Missing virtual environment. Run python3.13 -m venv .venv and install requirements.' >&2; exit 1; }
: "${DB_NAME:?Set DB_NAME explicitly; use jedel_dev for isolated development}"
: "${DB_USER:?Set DB_USER}"
: "${DB_PASSWORD:?Set DB_PASSWORD}"
export DJANGO_DEBUG=true
.venv/bin/python manage.py check
.venv/bin/python - <<'PY'
import socket
with socket.socket() as probe:
    if probe.connect_ex(('127.0.0.1', 8000)) == 0:
        raise SystemExit('Port 8000 is occupied. Stop its owner explicitly; no process was killed.')
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from config.urls import health
if health(None).status_code != 200:
    raise SystemExit('Database unavailable or schema incomplete. Check credentials and initialization; no migrations were applied.')
PY
exec .venv/bin/python manage.py runserver 127.0.0.1:8000
