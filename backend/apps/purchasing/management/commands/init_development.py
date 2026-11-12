"""Explicit empty-database bootstrap for isolated development only."""
import os
import re
from pathlib import Path
from django.conf import settings
from django.core.management import BaseCommand, CommandError, call_command
from django.db import connection, transaction

class Command(BaseCommand):
    help = 'Initialize only an empty explicitly isolated jedel_dev database, without historical data.'
    def handle(self, *args, **options):
        if os.getenv('JEDEL_ISOLATED_DEVELOPMENT') != '1' or connection.settings_dict['NAME'] != 'jedel_dev':
            raise CommandError('Requires JEDEL_ISOLATED_DEVELOPMENT=1 and DB_NAME=jedel_dev. Never use for jedel_group_db.')
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(%s)', [74832911])
                tables = set(connection.introspection.table_names(cursor))
                required = {'suppliers', 'products', 'purchase_orders', 'purchase_order_items'}
                if not tables:
                    dump = (Path(settings.BASE_DIR).parent / 'database/dumps/jedel_group_db.sql').read_text(encoding='utf-8')
                    patterns = [r'CREATE TABLE public\.[a-z_]+ \(.*?;', r'ALTER TABLE public\.[a-z_]+ ALTER COLUMN.*?;', r'ALTER TABLE ONLY public\.[a-z_]+.*?;']
                    statements = [(m.start(), m.group()) for pattern in patterns for m in re.finditer(pattern, dump, re.S)]
                    if len(statements) != 17:
                        raise CommandError('Dump schema changed. Review initialization before proceeding.')
                    for _, statement in sorted(statements):
                        cursor.execute(statement)
                elif not required.issubset(tables):
                    raise CommandError('Nonempty database is missing business schema; refusing initialization.')
        call_command('migrate', interactive=False)
        call_command('setup_roles', confirm=True)
        self.stdout.write('Isolated development schema ready. Existing records were not imported or rewritten.')
