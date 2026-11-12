import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase
from .local_environment import load_environment

class LocalEnvironmentTests(SimpleTestCase):
    def test_literals_and_process_override(self):
        with TemporaryDirectory() as temp, patch.dict(os.environ, {'DB_USER': 'external'}, clear=True):
            path = Path(temp) / '.env'
            path.write_text("# comment\nDB_USER=local\nDB_PASSWORD=\"p=a#ss\"\nLOCAL_VALUE='literal $value'\n", encoding="utf-8")
            load_environment(path)
            self.assertEqual(os.environ['DB_USER'], 'external')
            self.assertEqual(os.environ['DB_PASSWORD'], 'p=a#ss')
            self.assertEqual(os.environ['LOCAL_VALUE'], 'literal $value')

    def test_invalid_syntax_does_not_expose_secret(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / '.env'
            path.write_text('DB_PASSWORD="private-secret', encoding='utf-8')
            with self.assertRaises(ImproperlyConfigured) as caught:
                load_environment(path)
            self.assertNotIn('private-secret', str(caught.exception))

    def test_development_server_reports_unavailable_database_without_migrating(self):
        from io import StringIO
        from django.db import OperationalError
        from apps.purchasing.management.commands.runserver import Command
        with self.settings(DEBUG=True), patch('django.db.migrations.executor.MigrationExecutor', side_effect=OperationalError('private connection details')):
            output = StringIO()
            command = Command(stderr=output)
            command.check_migrations()
            self.assertIn('No migrations were applied', output.getvalue())
            self.assertNotIn('private connection details', output.getvalue())

    def test_single_command_server_keeps_django_admin_static_assets_enabled(self):
        from apps.purchasing.management.commands.runserver import Command
        from django.contrib.staticfiles.handlers import StaticFilesHandler
        with self.settings(DEBUG=True):
            self.assertIsInstance(Command().get_handler(use_static_handler=True, insecure_serving=False), StaticFilesHandler)
