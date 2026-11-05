from django.conf import settings
from django.core.management.base import CommandError
from django.core.management.commands.runserver import Command as DjangoRunserver


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
        return super().check_migrations()
