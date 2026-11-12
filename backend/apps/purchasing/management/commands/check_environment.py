"""Read-only native setup diagnostics; never initialize the configured database."""
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.migrations.executor import MigrationExecutor


class Command(BaseCommand):
    help = 'Read-only database/schema/auth/role readiness; never migrates or seeds.'

    def handle(self, *args, **options):
        missing_settings = ['DB_' + name for name, field in [('NAME','NAME'),('HOST','HOST'),('PORT','PORT'),('USER','USER'),('PASSWORD','PASSWORD')] if not connection.settings_dict.get(field)]
        if missing_settings:
            raise CommandError('Missing private connection settings: ' + ', '.join(missing_settings) + '. Edit backend/.env; no database query or change performed.')
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute('SET TRANSACTION READ ONLY')
                    cursor.execute('SHOW server_version_num')
                    version = int(cursor.fetchone()[0])
                    if not 170000 <= version < 180000:
                        raise CommandError('Use PostgreSQL 17 for the reviewed development setup.')
                    tables = set(connection.introspection.table_names(cursor))
                    required = {'suppliers', 'products', 'purchase_orders', 'purchase_order_items',
                                'auth_user', 'auth_group', 'django_session', 'django_migrations'}
                    missing = required - tables
                    if missing:
                        raise CommandError('Missing schema tables: ' + ', '.join(sorted(missing)) +
                                           '. Only a NEW isolated jedel_dev may use init_development. Existing databases require migration review.')
                    from apps.purchasing.models import Supplier, Product, PurchaseOrder, PurchaseOrderItem
                    for model in (Supplier, Product, PurchaseOrder, PurchaseOrderItem):
                        columns = {column.name for column in connection.introspection.get_table_description(cursor, model._meta.db_table)}
                        if {field.column for field in model._meta.local_fields} - columns:
                            raise CommandError('Business schema columns differ for ' + model._meta.db_table + '. Review schema; no changes made.')
                executor = MigrationExecutor(connection)
                if executor.migration_plan(executor.loader.graph.leaf_nodes()):
                    raise CommandError('Unapplied managed migrations. Review migrate --plan; do not migrate an existing business database without approval.')
                from django.contrib.auth.models import Group
                from apps.purchasing.accounts import ROLES
                missing_roles = set(ROLES) - set(Group.objects.values_list('name', flat=True))
                if missing_roles:
                    raise CommandError('Missing application roles. Review setup_roles --dry-run; existing databases require approval before writes.')
        except CommandError:
            raise
        except Exception as error:
            raise CommandError('Database readiness failed (' + type(error).__name__ +
                               '). Check PostgreSQL service and private backend/.env credentials. No database changes made.') from None
        self.stdout.write('READY: PostgreSQL 17, four business tables, auth/session migrations and six roles. Read-only check; no records changed.')
