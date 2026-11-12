"""Portable first-time native setup. Never initializes a database implicitly."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run(args, cwd=ROOT, env=None):
    subprocess.run([str(arg) for arg in args], cwd=cwd, env=env, check=True)


def postgres_bin():
    found = shutil.which('pg_config')
    if found:
        return Path(found).parent
    candidates = [Path(os.environ.get('PG_BIN', '/nonexistent')),
                  Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'PostgreSQL/17/bin',
                  Path('/opt/homebrew/opt/postgresql@17/bin'), Path('/usr/local/opt/postgresql@17/bin')]
    return next((path for path in candidates if (path / ('pg_config.exe' if os.name == 'nt' else 'pg_config')).exists()), None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-only', action='store_true', help='No installation or configuration writes')
    parser.add_argument('--skip-install', action='store_true', help='Use existing dependencies')
    parser.add_argument('--non-interactive', action='store_true', help='Leave new database password blank for private editing')
    args = parser.parse_args()
    if sys.version_info[:2] != (3, 13):
        raise SystemExit('Install Python 3.13 and rerun with that interpreter.')
    node, npm = shutil.which('node'), shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not node or not npm:
        raise SystemExit('Install Node.js 22.12+ (22 LTS) with npm, then reopen your terminal.')
    version = tuple(map(int, subprocess.check_output([node, '--version'], text=True).strip().lstrip('v').split('.')))
    if not ((version[0] == 22 and version >= (22, 12, 0)) or version[0] == 24):
        raise SystemExit('Use reviewed Node 22.12+ or Node 24; Angular CLI is installed locally.')
    print('Python 3.13 and supported Node detected.', flush=True)
    pg = postgres_bin()
    if not pg:
        raise SystemExit('Install PostgreSQL 17 (including pg_config), or set PG_BIN to its bin directory. On macOS: brew install postgresql@17.')
    env = os.environ.copy()
    env['PATH'] = str(pg) + os.pathsep + env.get('PATH', '')
    backend = ROOT / 'backend'
    python = backend / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not args.check_only and not args.skip_install:
        if not python.exists():
            if (backend / '.venv').exists():
                raise SystemExit('Existing .venv has no interpreter for this OS. Preserve/rename it and create a fresh platform-local venv; setup will not overwrite it.')
            print('Creating platform-local backend/.venv...', flush=True)
            run([sys.executable, '-m', 'venv', backend / '.venv'])
        print('Installing pinned Python and locked frontend dependencies...', flush=True)
        run([python, '-m', 'pip', 'install', '-r', backend / 'requirements.txt'], env=env)
        run([npm, 'ci'], cwd=ROOT / 'frontend')
    if not python.exists():
        raise SystemExit('backend/.venv is missing. Run setup without --check-only/--skip-install; do not copy a venv between operating systems.')
    venv_version = subprocess.check_output([str(python), '-c', 'import sys; print("%s.%s" % sys.version_info[:2])'], text=True).strip()
    if venv_version != '3.13':
        raise SystemExit('Existing venv is not Python 3.13. Preserve/rename it and rerun setup; no environment was deleted.')
    path = backend / '.env'
    if not path.exists() and not args.check_only:
        password = '' if args.non_interactive else getpass.getpass('Password for your NEW isolated jedel_dev database role (not displayed): ')
        defaults = {'DJANGO_DEBUG': 'true', 'DJANGO_SECRET_KEY': secrets.token_urlsafe(48),
                    'DJANGO_ALLOWED_HOSTS': 'localhost,127.0.0.1,[::1]',
                    'CSRF_TRUSTED_ORIGINS': 'http://localhost:4200,http://127.0.0.1:4200',
                    'CORS_ALLOWED_ORIGINS': 'http://localhost:4200,http://127.0.0.1:4200',
                    'DB_NAME': 'jedel_dev', 'DB_USER': 'jedel_dev', 'DB_PASSWORD': password,
                    'DB_HOST': '127.0.0.1', 'DB_PORT': '5432', 'DB_SSLMODE': 'prefer',
                    'JEDEL_ISOLATED_DEVELOPMENT': '1'}
        template = (backend / '.env.example').read_text(encoding='utf-8-sig')
        content = re.sub(r'^([A-Z_]+)=(.*)$', lambda match: match[1] + '=' + json.dumps(defaults.get(match[1], match[2])), template, flags=re.M)
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            stream.write(content)
        print('Created private backend/.env for jedel_dev. No existing configuration overwritten.', flush=True)
    elif path.exists():
        print('Preserved existing backend/.env unchanged.', flush=True)
    else:
        raise SystemExit('Missing backend/.env. Run first-time setup or configure it privately.')
    run([python, 'manage.py', 'check'], cwd=backend)
    result = subprocess.run([str(python), 'manage.py', 'check_environment'], cwd=backend)
    if result.returncode:
        print('Setup installed dependencies; database is NOT ready. See diagnostics above.\n'
              'For a NEW isolated jedel_dev only: create the empty database/role as documented, then run\n'
              '  python manage.py init_development\n'
              '  python manage.py createsuperuser\n'
              'Never initialize/migrate jedel_group_db without approval.', flush=True)
        return 2
    print('Native setup READY. Start with scripts/start-windows.ps1 or scripts/start-macos.sh.\n'
          'Or activate backend/.venv and use python manage.py runserver; frontend: npm start.')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError:
        raise SystemExit('A setup command failed. Review the tool error above. macOS source builds need Xcode Command Line Tools and PostgreSQL pg_config. No database initialization was performed.') from None
