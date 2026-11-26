"""Bootstrap the shared catalog in an explicitly isolated empty database."""
import os
from django.core.management import BaseCommand, CommandError, call_command
from django.db import connection


class Command(BaseCommand):
    help = 'Initialize and synchronize only a completely empty isolated jedel_dev database.'

    def add_arguments(self, parser):
        parser.add_argument('--skip-unless-isolated', action='store_true')

    def handle(self, *args, **options):
        if os.getenv('JEDEL_ISOLATED_DEVELOPMENT') != '1' or connection.settings_dict['NAME'] != 'jedel_dev':
            if options['skip_unless_isolated']:
                self.stdout.write('Not an explicitly isolated jedel_dev; automatic initialization skipped.')
                return
            raise CommandError('Requires JEDEL_ISOLATED_DEVELOPMENT=1 and DB_NAME=jedel_dev.')
        with connection.cursor() as cursor:
            tables = connection.introspection.table_names(cursor)
        if tables:
            self.stdout.write('Existing database schema detected; automatic initialization and seeding skipped.')
            return
        call_command('init_development')
        call_command('sync_shared_catalog')
