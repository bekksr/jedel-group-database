from django.conf import settings
from django.db import DatabaseError
from django.core.management.base import CommandError
from django.contrib.staticfiles.management.commands.runserver import Command as DjangoRunserver


class Command(DjangoRunserver):
    help = "Run development server, optionally without the database migration-history check."

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            '--skip-migration-check', action='store_true',
            help='Development only: start the API without querying migration history.',
        )

    def handle(self, *args, **options):
        self.skip_migration_check = options.pop('skip_migration_check', False)
        if self.skip_migration_check and not settings.DEBUG:
            raise CommandError('--skip-migration-check requires DJANGO_DEBUG=true.')
        return super().handle(*args, **options)

    def check_migrations(self):
        if getattr(self, 'skip_migration_check', False):
            self.stdout.write(self.style.WARNING(
                'Migration history check skipped. Database connectivity is not verified.'
            ))
            return
        try:
            if settings.DATABASES['default']['NAME'] == 'jedel_group_db':
                from django.db import connections
                from django.db.migrations.executor import MigrationExecutor
                executor = MigrationExecutor(connections['default'])
                pending = executor.migration_plan(executor.loader.graph.leaf_nodes())
                if pending:
                    self.stdout.write(self.style.WARNING(
                        f'{len(pending)} authentication/admin migrations are pending. '
                        'Registration and login require database-owner approval and a verified backup before migration. '
                        'No migrations were applied.'
                    ))
                return
            return super().check_migrations()
        except DatabaseError:
            if not settings.DEBUG:
                raise
            missing = [name for name, field in [('DB_USER', 'USER'), ('DB_PASSWORD', 'PASSWORD'), ('DB_HOST', 'HOST'), ('DB_PORT', 'PORT'), ('DB_NAME', 'NAME')] if not settings.DATABASES['default'].get(field)]
            if missing:
                self.stderr.write(self.style.WARNING('Missing local configuration: ' + ', '.join(missing) + '. Set these in backend/.env.'))
            self.stderr.write(self.style.WARNING(
                'Database unavailable. The development server will start, but database features are unavailable. '
                'Set DB_USER and DB_PASSWORD in backend/.env and check PostgreSQL. '
                'No migrations were applied. Existing jedel_group_db migrations require approval.'
            ))
