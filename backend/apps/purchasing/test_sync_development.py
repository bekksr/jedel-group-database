"""Safety checks for the startup synchronization boundary."""
import io
from unittest.mock import patch
from django.core.management import call_command, CommandError
from django.test import SimpleTestCase, override_settings


class DevelopmentSyncSafetyTests(SimpleTestCase):
    def test_unmarked_launcher_skips_without_database_access(self):
        with patch.dict('os.environ', {'JEDEL_ISOLATED_DEVELOPMENT': '0'}), \
             patch('apps.purchasing.management.commands.sync_development.connection') as connection, \
             patch('apps.purchasing.management.commands.sync_development.call_command') as nested:
            connection.settings_dict = {'NAME': 'jedel_group_db'}
            out = io.StringIO()
            call_command('sync_development', apply=True, skip_unless_isolated=True, stdout=out)
            self.assertIn('skipped', out.getvalue())
            nested.assert_not_called()
            connection.cursor.assert_not_called()

    def test_nonisolated_requires_separate_explicit_workflow(self):
        with patch.dict('os.environ', {'JEDEL_ISOLATED_DEVELOPMENT': '1'}), \
             patch('apps.purchasing.management.commands.sync_development.connection') as connection:
            connection.settings_dict = {'NAME': 'jedel_group_db'}
            connection.vendor = 'postgresql'
            out = io.StringIO()
            call_command('sync_development', stdout=out)
            self.assertIn('add_fictional_products', out.getvalue())
            with self.assertRaises(CommandError):
                call_command('sync_development', apply=True, stdout=out)
            connection.cursor.assert_not_called()

    @override_settings(DEBUG=False)
    def test_production_settings_disable_automatic_writes(self):
        with patch.dict('os.environ', {'JEDEL_ISOLATED_DEVELOPMENT': '1'}), \
             patch('apps.purchasing.management.commands.sync_development.connection') as connection:
            connection.settings_dict = {'NAME': 'jedel_dev'}
            connection.vendor = 'postgresql'
            call_command('sync_development', apply=True, skip_unless_isolated=True, stdout=io.StringIO())
            connection.cursor.assert_not_called()
