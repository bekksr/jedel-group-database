#!/usr/bin/env bash
set -eu
task_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$task_root"
command -v docker >/dev/null 2>&1 || { echo 'Install and start Docker with Compose v2.' >&2; exit 1; }
if [ -e .env ]; then
  echo 'Preserved existing root .env.'
else
  command -v openssl >/dev/null 2>&1 || { echo 'Install openssl for local secret generation.' >&2; exit 1; }
  task_password="$(openssl rand -hex 48)"
  task_secret="$(openssl rand -hex 48)"
  # noclobber prevents overwriting a file created concurrently.
  (umask 077; set -C; sed -e "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$task_password/" -e "s/^DJANGO_SECRET_KEY=$/DJANGO_SECRET_KEY=$task_secret/" .env.example > .env)
  unset task_password task_secret
  echo 'Created private root .env with independent development secrets.'
fi
docker compose config --quiet
echo 'Ready: docker compose up --build. No services started or database records changed.'
