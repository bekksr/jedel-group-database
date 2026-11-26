"""Only called within the marked temporary cluster by test_postgres.py."""
import os
import json
from decimal import Decimal
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
catalog_path = backend.parent / 'database' / 'shared_catalog.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
expected_products = catalog['products']
expected_suppliers = catalog['suppliers']

def assert_shared_catalog(cursor):
    cursor.execute('SELECT count(*) FROM products')
    assert cursor.fetchone()[0] == len(expected_products), 'Product count differs from the committed shared catalog.'
    cursor.execute('SELECT count(*) FROM suppliers')
    assert cursor.fetchone()[0] == len(expected_suppliers) + 1, 'Shared suppliers or local restart sentinel are missing.'
    for source in expected_products:
        cursor.execute('SELECT category, unit_price, stock_quantity FROM products WHERE product_name=%s', [source['product_name']])
        row = cursor.fetchone()
        assert row is not None, f"Shared product is missing after restart: {source['product_name']}"
        assert row == (source.get('category'), Decimal(str(source['unit_price'])), source['stock_quantity']), f"Shared product differs after restart: {source['product_name']}"
    for source in expected_suppliers:
        cursor.execute('SELECT supplier_name FROM suppliers WHERE email=%s', [source['email']])
        assert cursor.fetchone() == (source['supplier_name'],), f"Shared supplier is missing after restart: {source['email']}"
for args in [['migrate', '--plan']]:
    subprocess.run([sys.executable, 'manage.py', *args], cwd=backend, env=env, check=True)
ports = []
while len(ports) < 2:
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
        if port not in ports:
            ports.append(port)
if os.name == 'nt':
    startup = ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(backend.parent / 'scripts/start-windows.ps1'), '-CheckStartup', '-BackendPort', str(ports[0]), '-FrontendPort', str(ports[1])]
elif sys.platform == 'darwin':
    startup = ['bash', str(backend.parent / 'scripts/start-macos.sh'), '--check-startup', '--backend-port', str(ports[0]), '--frontend-port', str(ports[1])]
else:
    startup = [sys.executable, str(backend.parent / 'scripts/start.py'), '--check-startup', '--backend-port', str(ports[0]), '--frontend-port', str(ports[1])]

if os.getenv('JEDEL_VERIFY_NATIVE_SETUP') == '1':
    subprocess.run([sys.executable, str(backend.parent / 'scripts' / 'setup.py'), '--skip-install', '--non-interactive'], cwd=backend.parent, env=env, check=True)
else:
    # Reproduce an existing checkout with Django auth/session tables but no business schema.
    for app in ('auth', 'sessions'):
        subprocess.run([sys.executable, 'manage.py', 'migrate', app, '--noinput'], cwd=backend, env=env, check=True)
    preexisting = "from django.contrib.auth.models import User; from django.contrib.sessions.backends.db import SessionStore; u=User.objects.create_user('existing-checkout-user', password='disposable-test-password'); session=SessionStore(); session['sentinel']='preserved'; session.create(); print(u.password)"
    before = subprocess.run([sys.executable, 'manage.py', 'shell', '-c', preexisting], cwd=backend, env=env, check=True, capture_output=True, text=True).stdout.splitlines()[-1]
    subprocess.run(startup, cwd=backend.parent, env=env, check=True, timeout=150)
    after = subprocess.run([sys.executable, 'manage.py', 'shell', '-c', "from django.contrib.auth.models import User; from django.contrib.sessions.models import Session; assert Session.objects.count()==1; print(User.objects.get(username='existing-checkout-user').password)"], cwd=backend, env=env, check=True, capture_output=True, text=True).stdout.splitlines()[-1]
    assert before == after, 'Existing password hash changed'
# Reapply the current shared catalog twice, then preserve it and a registered
# User/session across a real temporary PostgreSQL restart.
for _ in range(2):
    subprocess.run([sys.executable, 'manage.py', 'sync_development', '--apply'], cwd=backend, env=env, check=True)
expected_users = 1 if os.getenv('JEDEL_VERIFY_NATIVE_SETUP') == '1' else 2
env['JEDEL_DEV_TEST_PASSWORD'] = secrets.token_urlsafe(40)
probe = """
import os,json
from rest_framework.test import APIClient
from django.test import override_settings
with override_settings(ALLOWED_HOSTS=['testserver']):
    client=APIClient()
    response=client.post('/api/auth/register/',{'name':'Fictional Restart User','username':'fictional-restart-user','email':'restart-user@example.test','password':os.environ['JEDEL_DEV_TEST_PASSWORD'],'password_confirm':os.environ['JEDEL_DEV_TEST_PASSWORD']},format='json')
    assert response.status_code==201, 'Disposable registration failed'
    assert client.get('/api/auth/me/').status_code==200
    assert client.get('/api/ai/capabilities/').data['chat_configured'] is False
print(json.dumps({'session':client.cookies['sessionid'].value}))
"""
registration = subprocess.run([sys.executable, 'manage.py', 'shell', '-c', probe], cwd=backend, env=env, check=True, capture_output=True, text=True)
env['JEDEL_DEV_TEST_SESSION'] = json.loads(registration.stdout.splitlines()[-1])['session']
print('Disposable registration, session and no-key local capabilities verified. Session credential retained only in memory.')
with psycopg2.connect(dbname='jedel_dev', **kwargs) as connection:
    with connection.cursor() as cursor:
        cursor.execute("INSERT INTO suppliers (supplier_name, email) VALUES ('Restart sentinel', 'restart@example.test')")
        assert_shared_catalog(cursor)
        cursor.execute('SELECT count(*) FROM purchase_orders'); assert cursor.fetchone()[0] == 0
        cursor.execute('SELECT count(*) FROM purchase_order_items'); assert cursor.fetchone()[0] == 0
        print('Verified current shared catalog and no invented purchasing records.', flush=True)
        cursor.execute("INSERT INTO purchase_orders (supplier_id, order_date, status) SELECT supplier_id, CURRENT_DATE, 'Pending' FROM suppliers WHERE email='restart@example.test'")
subprocess.run([sys.executable, 'manage.py', 'setup_fresh_demo'], cwd=backend, env=env, check=True)
with psycopg2.connect(dbname='jedel_dev', **kwargs) as connection:
    with connection.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM suppliers WHERE email='restart@example.test'")
        assert cursor.fetchone()[0] == 1, 'Initializer did not preserve existing development rows.'
        cursor.execute('SELECT count(*) FROM auth_group')
        assert cursor.fetchone()[0] == 7
        cursor.execute('SELECT count(*) FROM auth_user')
        assert cursor.fetchone()[0] == expected_users
        cursor.execute('SELECT count(*) FROM django_session')
        assert cursor.fetchone()[0] == expected_users
data = Path(os.environ['JEDEL_TEST_CLUSTER_DATA']).resolve()
binary = Path(os.environ['JEDEL_TEST_PG_BIN']).resolve()
if data.name != 'cluster' or not data.parent.name.startswith('jedel-isolated-pg-'):
    raise SystemExit('Refusing restart of an unexpected PostgreSQL path.')
from test_postgres import run
flags = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
run([str(binary / ('pg_ctl.exe' if os.name == 'nt' else 'pg_ctl')), '-D', str(data), '-m', 'fast', '-w', 'stop'], env=env, **flags)
socket_option = f' -c unix_socket_directories={data.parent}' if os.name != 'nt' else ''
run([str(binary / ('pg_ctl.exe' if os.name == 'nt' else 'pg_ctl')), '-D', str(data), '-l', str(data.parent / 'postgres.log'), '-o', f"-h 127.0.0.1 -p {env['DB_PORT']} -c jedel.isolated_test_cluster=on{socket_option}", '-w', 'start'], env=env, **flags)
with psycopg2.connect(dbname='jedel_dev', **kwargs) as connection:
    with connection.cursor() as cursor:
        cursor.execute('SELECT count(*) FROM auth_user'); assert cursor.fetchone()[0] == expected_users
        cursor.execute('SELECT count(*) FROM django_session'); assert cursor.fetchone()[0] == expected_users
        assert_shared_catalog(cursor)
        cursor.execute('SELECT count(*) FROM purchase_orders'); assert cursor.fetchone()[0] == 1
        cursor.execute('SELECT count(*) FROM purchase_order_items'); assert cursor.fetchone()[0] == 0
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
# A just-closed listening port may remain unavailable in TIME_WAIT on Unix.
# Select fresh ports for the second launcher instead of disturbing other processes.
restart_ports = []
while len(restart_ports) < 2:
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        candidate = probe.getsockname()[1]
        if candidate not in ports and candidate not in restart_ports:
            restart_ports.append(candidate)
backend_flag, frontend_flag = ('-BackendPort', '-FrontendPort') if os.name == 'nt' else ('--backend-port', '--frontend-port')
startup[startup.index(backend_flag) + 1] = str(restart_ports[0])
startup[startup.index(frontend_flag) + 1] = str(restart_ports[1])
subprocess.run(startup, cwd=backend.parent, env=env, check=True, timeout=150)
with psycopg2.connect(dbname='jedel_dev', **kwargs) as connection:
    with connection.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM purchase_orders o JOIN suppliers s ON s.supplier_id=o.supplier_id WHERE s.email='restart@example.test'")
        assert cursor.fetchone()[0] == 1, 'Existing order was not preserved'
        assert_shared_catalog(cursor)
print('PASS: fresh initialization, seven role groups, shared catalog idempotence, registration/session/no-key tools and real isolated PostgreSQL restart preserve shared products, suppliers, users, sessions and local purchasing records.')
