import io
import os
from unittest.mock import patch
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.db import connection


class PortabilityTests(TestCase):
    def test_environment_check_is_read_only(self):
        call_command('setup_roles', confirm=True, stdout=io.StringIO())
        output = io.StringIO()
        call_command('check_environment', stdout=output)
        self.assertIn('Read-only check', output.getvalue())

    def test_initialization_and_demo_reject_live_database(self):
        with patch.dict(os.environ, {'JEDEL_ISOLATED_DEVELOPMENT': '1'}), patch.dict(connection.settings_dict, {'NAME':'jedel_group_db'}):
            for command in ('init_development', 'seed_demo'):
                with self.subTest(command=command), self.assertRaises(CommandError):
                    call_command(command, **({'confirm':True} if command=='seed_demo' else {}), stdout=io.StringIO())

    def test_demo_requires_explicit_confirmation(self):
        with self.assertRaises(CommandError):
            call_command('seed_demo', stdout=io.StringIO())
