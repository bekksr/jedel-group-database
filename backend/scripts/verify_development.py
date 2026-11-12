"""Only called within the marked temporary cluster by test_postgres.py."""
import os
from pathlib import Path
import subprocess
import sys
import secrets
import socket
import psycopg2

if os.getenv('JEDEL_ISOLATED_TESTS') != '1' or os.getenv('DB_NAME') != 'postgres' or os.getenv('DB_HOST') != '127.0.0.1' or os.getenv('DB_PORT') == '5432':
    raise SystemExit('Refusing development verification outside guarded temporary cluster.')
kwargs = dict(host=os.environ['DB_HOST'], port=os.environ['DB_PORT'], user=os.environ['DB_USER'], password=os.environ['DB_PASSWORD'])
connection = psycopg2.connect(dbname='postgres', **kwargs)
try:
    connection.autocommit = True
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_setting('jedel.isolated_test_cluster', true)")
        if cursor.fetchone()[0] != 'on':
            raise SystemExit('Missing isolated cluster marker.')
        cursor.execute('CREATE DATABASE jedel_dev')
finally:
    connection.close()
env = os.environ.copy()
env.update(DB_NAME='jedel_dev', JEDEL_ISOLATED_DEVELOPMENT='1')
backend = Path(__file__).resolve().parents[1]
for args in [['migrate', '--plan'], ['init_development']]:
    subprocess.run([sys.executable, 'manage.py', *args], cwd=backend, env=env, check=True)
# Create fictional sample data explicitly, prove repeatability, then preserve it
# and a registered Basic User/session across a real temporary server restart.
for _ in range(2):
    subprocess.run([sys.executable, 'manage.py', 'seed_demo', '--confirm'], cwd=backend, env=env, check=True)
env['JEDEL_DEV_TEST_PASSWORD'] = secrets.token_urlsafe(40)
probe = """
import os,json
from rest_framework.test import APIClient
from django.test import override_settings
with override_settings(ALLOWED_HOSTS=['testserver']):
    client=APIClient()
    response=client.post('/api/auth/register/',{'name':'Fictional Restart User','email':'restart-user@example.test','password':os.environ['JEDEL_DEV_TEST_PASSWORD'],'password_confirm':os.environ['JEDEL_DEV_TEST_PASSWORD']},format='json')
    assert response.status_code==201, 'Disposable registration failed'
    assert client.get('/api/auth/me/').status_code==200
    assert client.get('/api/ai/capabilities/').data['chat_configured'] is False
print(json.dumps({'session':client.cookies['sessionid'].value}))
"""
registration = subprocess.run([sys.executable, 'manage.py', 'shell', '-c', probe], cwd=backend, env=env, check=True, capture_output=True, text=True)
import json
env['JEDEL_DEV_TEST_SESSION'] = json.loads(registration.stdout.splitlines()[-1])['session']
print('Disposable registration, session and no-key local capabilities verified. Session credential retained only in memory.')
with psycopg2.connect(dbname='jedel_dev', **kwargs) as connection:
    with connection.cursor() as cursor:
        cursor.execute("INSERT INTO suppliers (supplier_name, email) VALUES ('Restart sentinel', 'restart@example.test')")
        cursor.execute("SELECT count(*) FROM products")
        assert cursor.fetchone()[0] == 2, 'Explicit fictional sample data differs.'
subprocess.run([sys.executable, 'manage.py', 'init_development'], cwd=backend, env=env, check=True)
with psycopg2.connect(dbname='jedel_dev', **kwargs) as connection:
    with connection.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM suppliers WHERE email='restart@example.test'")
        assert cursor.fetchone()[0] == 1, 'Initializer did not preserve existing development rows.'
        cursor.execute('SELECT count(*) FROM auth_group')
        assert cursor.fetchone()[0] == 6
        cursor.execute('SELECT count(*) FROM auth_user')
        assert cursor.fetchone()[0] == 1
        cursor.execute('SELECT count(*) FROM django_session')
        assert cursor.fetchone()[0] == 1
data = Path(os.environ['JEDEL_TEST_CLUSTER_DATA']).resolve()
binary = Path(os.environ['JEDEL_TEST_PG_BIN']).resolve()
if data.name != 'cluster' or not data.parent.name.startswith('jedel-isolated-pg-'):
    raise SystemExit('Refusing restart of an unexpected PostgreSQL path.')
from test_postgres import run
flags = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
run([str(binary / ('pg_ctl.exe' if os.name == 'nt' else 'pg_ctl')), '-D', str(data), '-m', 'fast', '-w', 'stop'], env=env, **flags)
run([str(binary / ('pg_ctl.exe' if os.name == 'nt' else 'pg_ctl')), '-D', str(data), '-l', str(data.parent / 'postgres.log'), '-o', f"-h 127.0.0.1 -p {env['DB_PORT']} -c jedel.isolated_test_cluster=on", '-w', 'start'], env=env, **flags)
with psycopg2.connect(dbname='jedel_dev', **kwargs) as connection:
    with connection.cursor() as cursor:
        cursor.execute('SELECT count(*) FROM auth_user'); assert cursor.fetchone()[0] == 1
        cursor.execute('SELECT count(*) FROM django_session'); assert cursor.fetchone()[0] == 1
        cursor.execute('SELECT count(*), sum(stock_quantity) FROM products'); assert cursor.fetchone() == (2,15)
        cursor.execute('SELECT count(*) FROM purchase_orders'); assert cursor.fetchone()[0] == 0
subprocess.run([sys.executable, 'manage.py', 'check_environment'], cwd=backend, env=env, check=True)
resume = """
import os
from rest_framework.test import APIClient
from django.test import override_settings
with override_settings(ALLOWED_HOSTS=['testserver']):
    client=APIClient()
    client.cookies['sessionid']=os.environ['JEDEL_DEV_TEST_SESSION']
    response=client.get('/api/auth/me/')
    assert response.status_code==200 and response.data['email']=='restart-user@example.test', 'Existing cookie did not restore authentication after database restart'
print('PASS: existing session cookie restores the registered user in a new Django process after PostgreSQL restart.')
"""
subprocess.run([sys.executable, 'manage.py', 'shell', '-c', resume], cwd=backend, env=env, check=True)
ports = []
while len(ports) < 2:
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
        if port not in ports:
            ports.append(port)
subprocess.run([sys.executable, str(backend.parent / 'scripts/start.py'), '--check-startup', '--backend-port', str(ports[0]), '--frontend-port', str(ports[1])], cwd=backend.parent, env=env, check=True, timeout=150)
print('PASS: fresh initialization, six roles, explicit demo idempotence, registration/session/no-key tools, repeated initialization and real isolated PostgreSQL restart preserve users, sessions and inventory.')
