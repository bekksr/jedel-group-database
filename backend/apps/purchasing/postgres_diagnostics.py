"""Independent libpq diagnosis. Never expose raw stderr, passwords, or DSNs."""
import locale
import os
from pathlib import Path
import shutil
import subprocess


def find_psql():
    candidates = []
    if os.getenv('PG_BIN'):
        candidates.append(Path(os.environ['PG_BIN']) / ('psql.exe' if os.name == 'nt' else 'psql'))
    candidates.append(Path(os.getenv('ProgramFiles', r'C:\Program Files')) / 'PostgreSQL/17/bin/psql.exe')
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return shutil.which('psql')


def classify_error(payload):
    # libpq startup errors can arrive in the Windows code page before the
    # connection's client_encoding has been negotiated. Do not print this text.
    encodings = dict.fromkeys(['utf-8', locale.getpreferredencoding(False), 'cp1251', 'cp866'])
    for encoding in encodings:
        try:
            message = payload.decode(encoding).lower()
        except (UnicodeDecodeError, LookupError):
            continue
        if 'password authentication failed' in message or '\u043f\u0430\u0440\u043e\u043b' in message:
            return 'authentication_rejected'
        missing = 'does not exist' in message or '\u043d\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442' in message
        if missing and ('database' in message or '\u0431\u0430\u0437' in message):
            return 'database_missing'
        if 'connection refused' in message or 'could not connect' in message:
            return 'server_unreachable'
    return 'connection_failed'


def psql_read_only(config):
    executable = find_psql()
    if not executable:
        return {'status': 'psql_unavailable'}
    env = os.environ.copy()
    # Match Django's explicit parameters; don't inherit a libpq service profile.
    for name in ['PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']:
        env.pop(name, None)
    env.update(PGPASSWORD=config['PASSWORD'], PGCONNECT_TIMEOUT='5', PGSSLMODE=config.get('OPTIONS', {}).get('sslmode', 'prefer'))
    sql = "BEGIN READ ONLY; SELECT current_database(), current_setting('transaction_read_only'); ROLLBACK;"
    args = [executable, '-X', '-w', '-q', '-t', '-A', '-F', '\t', '-h', config['HOST'], '-p', str(config['PORT']), '-U', config['USER'], '-d', config['NAME'], '-c', sql]
    try:
        result = subprocess.run(args, env=env, stdin=subprocess.DEVNULL, capture_output=True, timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return {'status': 'psql_unavailable_or_timeout'}
    if result.returncode:
        return {'status': classify_error(result.stderr)}
    try:
        lines = result.stdout.decode('utf-8').strip().splitlines()
    except UnicodeDecodeError:
        return {'status': 'unexpected_psql_output'}
    if lines != [config['NAME'] + '\ton']:
        return {'status': 'unexpected_psql_output'}
    return {'status': 'authenticated_read_only_query_succeeded', 'database': config['NAME'], 'transaction_read_only': True}


def diagnosis_message(result):
    return {
        'authentication_rejected': 'psql independently confirms PostgreSQL rejected the configured role/password. Re-enter the existing PostgreSQL password; authentication was not weakened.',
        'database_missing': 'psql reports that the configured database does not exist. Check DB_NAME; no database was created or restored.',
        'server_unreachable': 'psql could not reach the configured PostgreSQL host/port. Check the running service and public connection settings.',
        'authenticated_read_only_query_succeeded': 'psql authenticated and completed a read-only query, but Django verification failed. Review driver/schema/SELECT privileges; this is not evidence of a bad password.',
    }.get(result['status'], 'The independent psql check could not identify a specific connection cause. Check PostgreSQL settings and credentials locally; no raw driver errors or secrets were logged.')
