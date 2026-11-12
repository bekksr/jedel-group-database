"""Restore a private backup only into the guarded disposable PostgreSQL cluster."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import psycopg2

backend = Path(__file__).resolve().parents[1]
root = backend.parent
source = Path(os.environ['JEDEL_REHEARSAL_BACKUP']).resolve()
if source.parent != (root / 'database/backups').resolve() or not source.is_file():
    raise SystemExit('Backup must be an existing private file in database/backups.')
if os.getenv('JEDEL_ISOLATED_TESTS') != '1' or os.getenv('DB_NAME') != 'postgres' or os.getenv('DB_HOST') != '127.0.0.1' or os.getenv('DB_PORT') == '5432':
    raise SystemExit('Refusing rehearsal outside the guarded temporary cluster.')
kwargs = dict(host=os.environ['DB_HOST'], port=os.environ['DB_PORT'], user=os.environ['DB_USER'], password=os.environ['DB_PASSWORD'])
connection = psycopg2.connect(dbname='postgres', **kwargs)
try:
    connection.autocommit = True
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_setting('jedel.isolated_test_cluster', true)")
        if cursor.fetchone()[0] != 'on':
            raise SystemExit('Missing isolated-cluster marker.')
        cursor.execute('CREATE DATABASE jedel_auth_rehearsal')
finally:
    connection.close()
pg = Path(os.getenv('PG_BIN', r'C:/Program Files/PostgreSQL/17/bin')) / ('pg_restore.exe' if os.name == 'nt' else 'pg_restore')
if not pg.is_file():
    pg = shutil.which('pg_restore')
    if not pg: raise SystemExit('pg_restore is required.')
env = os.environ.copy()
env.update(DB_NAME='jedel_auth_rehearsal', PGPASSWORD=os.environ['DB_PASSWORD'])
result = subprocess.run([str(pg), '-h', kwargs['host'], '-p', str(kwargs['port']), '-U', kwargs['user'], '--dbname=jedel_auth_rehearsal', '--no-owner', '--no-acl', '--exit-on-error', str(source)], env=env, capture_output=True, timeout=90)
if result.returncode:
    raise SystemExit('Private backup restore failed; raw output withheld. No live migration attempted.')

def fingerprints():
    result = {}
    with psycopg2.connect(dbname='jedel_auth_rehearsal', **kwargs) as connection:
        with connection.cursor() as cursor:
            for table, pk in [('suppliers','supplier_id'), ('products','product_id'), ('purchase_orders','order_id'), ('purchase_order_items','item_id')]:
                cursor.execute('SELECT to_jsonb(t)::text FROM ' + table + ' t ORDER BY ' + pk)
                data = hashlib.sha256('\n'.join(row[0] for row in cursor.fetchall()).encode()).hexdigest()
                cursor.execute("SELECT column_name,data_type,is_nullable,column_default,is_identity,identity_generation FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position", [table])
                columns = cursor.fetchall()
                cursor.execute("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid=%s::regclass ORDER BY conname", [table])
                constraints = cursor.fetchall()
                schema = hashlib.sha256(json.dumps([columns, constraints],default=str).encode()).hexdigest()
                result[table] = {'data_sha256': data, 'schema_sha256': schema}
    return result
before = fingerprints()
for command in [['migrate', '--plan'], ['migrate', '--noinput'], ['setup_roles'], ['check']]:
    subprocess.run([sys.executable,'manage.py',*command],cwd=backend,env=env,check=True)
after = fingerprints()
assert before == after, 'Business data or schema changed during additive migration rehearsal.'
report = '# Authentication migration rehearsal\n\nPASS: restored current live backup into a separate marked disposable PostgreSQL cluster.\n\n18 built-in Django migrations applied only to jedel_auth_rehearsal. System checks and role setup passed.\n\n'
report += 'Business record, captured-price, stock, column, identity and constraint fingerprints matched before/after for all four tables. Live database migrations remain NOT APPLIED.\n\n'
report += 'Private backup SHA256: `' + hashlib.sha256(source.read_bytes()).hexdigest() + '`\n\n'
report += '| Business table | Data fingerprint | Schema fingerprint |\n|---|---|---|\n'
for table, checks in after.items():
    report += '| '+table+' | '+checks['data_sha256']+' | '+checks['schema_sha256']+' |\n'
report += '\nRestore used --no-owner --no-acl in the disposable cluster. Original-owner/runtime GRANT validation remains a deployment gate. Backup is private and Git-ignored. No live records were rewritten or orders replayed.\n'
(root/'docs/AUTH_MIGRATION_REHEARSAL.md').write_text(report,encoding='utf-8')
print('PASS: current backup restored, additive migrations rehearsed; business schema/data fingerprints unchanged; no live migration applied.')
