"""Run real PostgreSQL tests in a short-lived, separate local cluster.

Does not use the installed service or any application database credentials.
"""
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile

BACKEND = Path(__file__).resolve().parents[1]


def run(args, *, check=True, **kwargs):
    if Path(args[0]).stem == 'pg_ctl':
        # A background postgres process can inherit Windows pipe handles;
        # use a real file so communicate() cannot wait for the server to exit.
        logfile = Path(args[args.index('-D') + 1]).parent / 'control.log'
        with logfile.open('a', encoding='utf-8') as output:
            result = subprocess.run(args, stdout=output, stderr=subprocess.STDOUT, timeout=60, **kwargs)
        print('Temporary PostgreSQL cluster: ' + args[-1], flush=True)
        if result.returncode:
            print(logfile.read_text(encoding='utf-8', errors='replace'), flush=True)
    elif len(args) > 2 and args[1:3] == ['manage.py', 'test']:
        # Stream diagnostics so a failed/slow browser scenario cannot hide the
        # completed tests when the outer safety timeout expires.
        result = subprocess.run(args, stderr=subprocess.STDOUT, **kwargs)
    else:
        result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', **kwargs)
        if result.stdout:
            print(result.stdout, end='', flush=True)
    if check:
        result.check_returncode()
    return result


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    configured = os.getenv('PG_BIN')
    candidates = [Path(configured)] if configured else [Path(r'C:\Program Files\PostgreSQL\17\bin')]
    binary = next((p for p in candidates if (p / ('initdb.exe' if os.name == 'nt' else 'initdb')).exists()), None)
    if binary is None:
        initdb = shutil.which('initdb')
        if not initdb:
            raise SystemExit('Set PG_BIN to the PostgreSQL bin directory containing initdb and pg_ctl.')
        binary = Path(initdb).parent
    suffix = '.exe' if os.name == 'nt' else ''
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix='jedel-isolated-pg-') as temporary:
        work = Path(temporary)
        if work.resolve().parent != Path(tempfile.gettempdir()).resolve() or not work.name.startswith('jedel-isolated-pg-'):
            raise RuntimeError('Unexpected temporary cluster directory.')
        password = secrets.token_urlsafe(40)
        password_file = work / 'password'
        password_file.write_text(password, encoding='utf-8')
        data = work / 'cluster'
        env = os.environ.copy()
        env.update({
            'JEDEL_LOAD_DOTENV': 'false', 'DJANGO_SETTINGS_MODULE': 'config.settings', 'DJANGO_DEBUG': 'true',
            'DJANGO_SECRET_KEY': secrets.token_urlsafe(48),
            'DB_NAME': 'postgres', 'DB_HOST': '127.0.0.1', 'DB_PORT': str(port),
            'DB_USER': 'jedel_test_admin', 'DB_PASSWORD': password, 'DB_SSLMODE': 'disable',
            'TEST_DB_NAME': 'test_jedel_api', 'JEDEL_ISOLATED_TESTS': '1',
            'ERP_READ_TOKEN': '', 'ERP_WRITE_TOKEN': '', 'ERP_BUYER_TOKEN': '', 'ERP_APPROVER_TOKEN': '', 'PGCONNECT_TIMEOUT': '5',
            'AI_ENABLED': 'false', 'GROQ_API_KEY': '', 'AI_MODEL': '',
            'AI_PROVIDER': 'groq',
            'JEDEL_TEST_CLUSTER_DATA': str(data), 'JEDEL_TEST_PG_BIN': str(binary),
            'PYTHONIOENCODING': 'utf-8', 'PYTHONUNBUFFERED': '1',
        })
        flags = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
        run([str(binary / ('initdb' + suffix)), '-D', str(data), '-U', 'jedel_test_admin', '--pwfile', str(password_file), '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', '--encoding=UTF8', '--locale=C'], check=True, env=env, **flags)
        password_file.unlink()
        started = False
        try:
            started = True
            run([str(binary / ('pg_ctl' + suffix)), '-D', str(data), '-l', str(work / 'postgres.log'), '-o', f'-h 127.0.0.1 -p {port} -c jedel.isolated_test_cluster=on', '-w', 'start'], check=True, env=env, **flags)
            started = True
            if os.getenv('JEDEL_REHEARSAL_BACKUP'):
                run([sys.executable, 'scripts/rehearse_auth_migrations.py'], timeout=120, cwd=BACKEND, env=env, **flags)
            if os.getenv('JEDEL_VERIFY_DEVELOPMENT') == '1':
                run([sys.executable, 'scripts/verify_development.py'], timeout=90, cwd=BACKEND, env=env, **flags)
            result = run([sys.executable, 'manage.py', 'test', *sys.argv[1:], '--noinput', '--verbosity', '2'], check=False, timeout=300, cwd=BACKEND, env=env, **flags)
            return result.returncode
        finally:
            if started:
                run([str(binary / ('pg_ctl' + suffix)), '-D', str(data), '-m', 'fast', '-w', 'stop'], check=False, env=env, **flags)


if __name__ == '__main__':
    raise SystemExit(main())
