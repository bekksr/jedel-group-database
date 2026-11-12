"""Only called within the marked temporary cluster by test_postgres.py."""
import os
from pathlib import Path
import subprocess
import sys
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
with psycopg2.connect(dbname='jedel_dev', **kwargs) as connection:
    with connection.cursor() as cursor:
        cursor.execute("INSERT INTO suppliers (supplier_name, email) VALUES ('Restart sentinel', 'restart@example.test')")
        cursor.execute("SELECT count(*) FROM products")
        assert cursor.fetchone()[0] == 0, 'Initializer imported business fixture data.'
subprocess.run([sys.executable, 'manage.py', 'init_development'], cwd=backend, env=env, check=True)
with psycopg2.connect(dbname='jedel_dev', **kwargs) as connection:
    with connection.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM suppliers WHERE email='restart@example.test'")
        assert cursor.fetchone()[0] == 1, 'Initializer did not preserve existing development rows.'
        cursor.execute('SELECT count(*) FROM auth_group')
        assert cursor.fetchone()[0] == 6
print('Development initialization verified: empty schema, additive Django migrations, six groups, repeated initialization preserves data.')
