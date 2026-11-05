"""Never create/drop/flush databases on an unmarked PostgreSQL server."""
import os
import re
from pathlib import Path
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import connections
from django.test.runner import DiscoverRunner

BUSINESS_TABLES = ('suppliers', 'products', 'purchase_orders', 'purchase_order_items')


def assert_isolated(connection):
    if os.getenv('JEDEL_ISOLATED_TESTS') != '1' or connection.vendor != 'postgresql':
        raise ImproperlyConfigured('Database tests require scripts/test_postgres.py and a dedicated PostgreSQL cluster.')
    if connection.settings_dict['HOST'] != '127.0.0.1' or str(connection.settings_dict['PORT']) == '5432':
        raise ImproperlyConfigured('Refusing database tests against the application server.')
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_setting('jedel.isolated_test_cluster', true)")
        if cursor.fetchone()[0] != 'on':
            raise ImproperlyConfigured('PostgreSQL server is not marked as an isolated Jedel test cluster.')


class IsolatedPostgresRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        aliases = kwargs.get('aliases', {'default'})
        if not aliases:
            return super().setup_databases(**kwargs)
        connection = connections['default']
        name = connection.settings_dict['TEST']['NAME']
        if not name.startswith('test_jedel_') or name == connection.settings_dict['NAME']:
            raise ImproperlyConfigured('Unsafe test database name.')
        assert_isolated(connection)
        # Migrations here affect only the new test database, never jedel_group_db.
        result = super().setup_databases(**kwargs)
        assert_isolated(connection)
        dump = (Path(settings.BASE_DIR).parent / 'database/dumps/jedel_group_db.sql').read_text(encoding='utf-8')
        # Execute only exact schema DDL from the original dump. No COPY, OWNER,
        # setval, role changes, or live database restore occurs.
        patterns = [r'CREATE TABLE public\.[a-z_]+ \(.*?;', r'ALTER TABLE public\.[a-z_]+ ALTER COLUMN.*?;', r'ALTER TABLE ONLY public\.[a-z_]+.*?;']
        statements = [(m.start(), m.group()) for pattern in patterns for m in re.finditer(pattern, dump, re.S)]
        if len(statements) != 17:
            raise ImproperlyConfigured('The source dump schema changed; review test bootstrap DDL.')
        with connection.cursor() as cursor:
            for _, statement in sorted(statements):
                cursor.execute(statement)
        return result
