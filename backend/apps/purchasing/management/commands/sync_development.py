"""Prepare an explicitly isolated development database before native startup."""
import os
from django.conf import settings
from django.core.management import BaseCommand, CommandError, call_command
from django.db import connection, transaction


class Command(BaseCommand):
    help = 'Preview readiness, or synchronize the explicitly isolated jedel_dev database.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--skip-unless-isolated', action='store_true')

    def handle(self, *args, **options):
        isolated = (os.getenv('JEDEL_ISOLATED_DEVELOPMENT') == '1'
                    and connection.settings_dict['NAME'] == 'jedel_dev'
                    and connection.vendor == 'postgresql'
                    and settings.DEBUG)
        if not isolated:
            if options['skip_unless_isolated']:
                self.stdout.write('Automatic database synchronization skipped: database is not explicitly isolated. Review check_environment and migration plans before making changes.')
                return
            if options['apply']:
                raise CommandError('Automatic synchronization is limited to isolated jedel_dev. For another database review the explicit product preview and confirmation workflow; no changes made.')
            self.stdout.write('No automatic schema, order or data changes are made here. For an existing business schema, preview fictional products with: python manage.py add_fictional_products. After review, use --apply --confirm-database <exact-name> --expected-additions <preview-count>. Orders and schema require separate review.')
            return
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(%s)', [74832911])
                cursor.execute('SHOW server_version_num')
                if not 170000 <= int(cursor.fetchone()[0]) < 180000:
                    raise CommandError('Only the reviewed PostgreSQL 17 schema is supported; no changes made.')
                tables = set(connection.introspection.table_names(cursor))
            business = {'products', 'suppliers', 'purchase_orders', 'purchase_order_items'}
            missing = business - tables
            self.stdout.write('Missing business tables: ' + (', '.join(sorted(missing)) if missing else 'none'))
            if not options['apply']:
                self.stdout.write('Preview only. For this isolated database run sync_development --apply to initialize and synchronize.')
                return
            if missing and missing != business:
                raise CommandError('Partial business schema requires manual review; no changes made.')
            from apps.purchasing.models import Supplier, Product, PurchaseOrder, PurchaseOrderItem
            models = (Supplier, Product, PurchaseOrder, PurchaseOrderItem)
            if not missing:
                with connection.cursor() as cursor:
                    for model in models:
                        columns = {column.name for column in connection.introspection.get_table_description(cursor, model._meta.db_table)}
                        if {field.column for field in model._meta.local_fields} - columns:
                            raise CommandError('Business schema differs for ' + model._meta.db_table + '; no changes made.')
            call_command('init_development')
            call_command('sync_shared_catalog')
            self.stdout.write('Database counts: ' + ', '.join(f'{m._meta.db_table}={m.objects.count()}' for m in models))
