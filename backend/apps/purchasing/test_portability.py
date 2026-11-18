import io
import os
from unittest.mock import patch
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.db import connection
from .models import Product, Supplier, PurchaseOrder, PurchaseOrderItem


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

    def test_demo_is_complete_and_repeatable(self):
        with patch.dict(os.environ, {'JEDEL_ISOLATED_DEVELOPMENT': '1'}), patch.dict(connection.settings_dict, {'NAME': 'jedel_dev'}):
            call_command('seed_demo', confirm=True, stdout=io.StringIO())
            call_command('seed_demo', confirm=True, stdout=io.StringIO())
        self.assertEqual(Product.objects.count(), 50)
        self.assertEqual(Supplier.objects.count(), 4)
        self.assertEqual(PurchaseOrder.objects.count(), 8)
        self.assertEqual(PurchaseOrderItem.objects.count(), 24)
        self.assertEqual(set(PurchaseOrder.objects.values_list('status', flat=True)), set(PurchaseOrder.Status.values))
