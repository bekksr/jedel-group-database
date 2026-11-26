import io
import os
from pathlib import Path
from unittest.mock import patch
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.db import connection
from .models import Product, Supplier, PurchaseOrder, PurchaseOrderItem


class PortabilityTests(TestCase):
    def test_compose_bootstrap_has_app_password_and_shared_catalog_rehearsal(self):
        root = Path(__file__).resolve().parents[3]
        env_template = (root / '.env.example').read_text(encoding='utf-8')
        self.assertRegex(env_template, r'(?m)^APP_DB_PASSWORD=$')
        for name in ('setup-docker.ps1', 'setup-docker.sh'):
            script = (root / 'scripts' / name).read_text(encoding='utf-8')
            self.assertIn('APP_DB_PASSWORD', script)
            self.assertIn('.env', script)
        rehearsal = (root / 'backend' / 'scripts' / 'verify_development.py').read_text(encoding='utf-8')
        self.assertIn('shared_catalog.json', rehearsal)
        self.assertIn('sync_development', rehearsal)
        self.assertNotIn("'seed_demo'", rehearsal)

    def test_committed_schema_dump_contains_no_copy_rows(self):
        dump = (Path(__file__).resolve().parents[3] / 'database' / 'dumps' / 'jedel_group_db.sql').read_text(encoding='utf-8')
        lines = dump.splitlines()
        starts = [index for index, line in enumerate(lines) if line.startswith('COPY public.')]
        self.assertEqual(len(starts), 4)
        self.assertTrue(all(lines[index + 1] == r'\.' for index in starts))

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

    def test_automatic_setup_skips_existing_schema_and_unapproved_database(self):
        with patch.dict(os.environ, {'JEDEL_ISOLATED_DEVELOPMENT': '1'}), patch.dict(connection.settings_dict, {'NAME': 'jedel_dev'}):
            output = io.StringIO()
            call_command('setup_fresh_demo', stdout=output)
            self.assertIn('skipped', output.getvalue())
        with patch.dict(connection.settings_dict, {'NAME': 'jedel_group_db'}):
            with self.assertRaises(CommandError):
                call_command('setup_fresh_demo', stdout=io.StringIO())

    def test_demo_is_complete_and_repeatable(self):
        with patch.dict(os.environ, {'JEDEL_ISOLATED_DEVELOPMENT': '1'}), patch.dict(connection.settings_dict, {'NAME': 'jedel_dev'}):
            call_command('seed_demo', confirm=True, stdout=io.StringIO())
            call_command('seed_demo', confirm=True, stdout=io.StringIO())
        self.assertEqual(Product.objects.count(), 55)
        self.assertEqual(Supplier.objects.count(), 4)
        self.assertEqual(PurchaseOrder.objects.count(), 8)
        self.assertEqual(PurchaseOrderItem.objects.count(), 24)
        self.assertEqual(set(PurchaseOrder.objects.values_list('status', flat=True)), set(PurchaseOrder.Status.values))

    def test_demo_upgrade_is_previewable_additive_and_idempotent(self):
        from .management.commands.seed_demo import EXTRA_PRODUCTS
        with patch.dict(os.environ, {'JEDEL_ISOLATED_DEVELOPMENT': '1'}), patch.dict(connection.settings_dict, {'NAME': 'jedel_dev'}):
            call_command('seed_demo', confirm=True, stdout=io.StringIO())
            Product.objects.filter(product_name__in=['[DEMO] ' + row[1] for row in EXTRA_PRODUCTS]).delete()
            original = Product.objects.get(product_name='[DEMO] Notebook Air 13')
            original.unit_price = '123.00'
            original.save(update_fields=['unit_price'])
            call_command('sync_demo_products', stdout=io.StringIO())
            self.assertEqual(Product.objects.count(), 50)
            for _ in range(2):
                call_command('sync_demo_products', apply=True, stdout=io.StringIO())
            self.assertEqual(Product.objects.count(), 55)
            original.refresh_from_db()
            self.assertEqual(str(original.unit_price), '123.00')
            self.assertEqual(PurchaseOrderItem.objects.count(), 24)

    def test_sync_new_fixture_preserves_changed_rows_and_relationships(self):
        from .management.commands.seed_demo import EXTRA_PRODUCTS
        with patch.dict(os.environ, {'JEDEL_ISOLATED_DEVELOPMENT': '1'}), patch.dict(connection.settings_dict, {'NAME': 'jedel_dev'}):
            call_command('seed_demo', confirm=True, stdout=io.StringIO())
            original = Product.objects.get(product_name='[DEMO] Notebook Air 13')
            original_id = original.pk
            original.unit_price = '123.00'
            original.save(update_fields=['unit_price'])
            fixture = EXTRA_PRODUCTS + [('Accessories', 'Future Fictional Adapter', 4000)]
            with patch('apps.purchasing.management.commands.sync_demo_products.EXTRA_PRODUCTS', fixture):
                preview = io.StringIO()
                call_command('sync_demo_products', stdout=preview)
                self.assertIn('conflicts: 1', preview.getvalue())
                self.assertIn('Future Fictional Adapter', preview.getvalue())
                self.assertFalse(Product.objects.filter(product_name='[DEMO] Future Fictional Adapter').exists())
                call_command('sync_demo_products', apply=True, stdout=io.StringIO())
                call_command('sync_demo_products', apply=True, stdout=io.StringIO())
            original.refresh_from_db()
            self.assertEqual((original.pk, str(original.unit_price)), (original_id, '123.00'))
            self.assertEqual(Product.objects.count(), 56)
            self.assertEqual(PurchaseOrderItem.objects.count(), 24)

    def test_sync_rolls_back_supplier_when_product_insert_fails(self):
        from .management.commands.seed_demo import EXTRA_PRODUCTS, DEMO_SUPPLIERS
        with patch.dict(os.environ, {'JEDEL_ISOLATED_DEVELOPMENT': '1'}), patch.dict(connection.settings_dict, {'NAME': 'jedel_dev'}):
            call_command('seed_demo', confirm=True, stdout=io.StringIO())
            extra = EXTRA_PRODUCTS + [('Accessories', 'New Fictional Adapter', 4000)]
            suppliers = DEMO_SUPPLIERS + [('[DEMO] New Fictional Supplier', 'new-supplier@example.test')]
            with patch('apps.purchasing.management.commands.sync_demo_products.EXTRA_PRODUCTS', extra), patch('apps.purchasing.management.commands.sync_demo_products.DEMO_SUPPLIERS', suppliers), patch('apps.purchasing.management.commands.sync_demo_products.Product.objects.bulk_create', side_effect=RuntimeError('simulated failure')):
                with self.assertRaises(RuntimeError):
                    call_command('sync_demo_products', apply=True, stdout=io.StringIO())
            self.assertFalse(Supplier.objects.filter(email='new-supplier@example.test').exists())
            self.assertEqual(Product.objects.count(), 55)

    def test_add_fictional_products_previews_and_preserves_existing_data(self):
        existing = Product.objects.create(product_name='Existing product', category='Existing', unit_price='12.00', stock_quantity=7)
        call_command('add_fictional_products', stdout=io.StringIO())
        self.assertEqual(Product.objects.count(), 1)
        with self.assertRaises(CommandError):
            call_command('add_fictional_products', apply=True, confirm_database='wrong', stdout=io.StringIO())
        for _ in range(2):
            call_command('add_fictional_products', apply=True, confirm_database=connection.settings_dict['NAME'], stdout=io.StringIO())
        self.assertEqual(Product.objects.count(), 56)
        existing.refresh_from_db()
        self.assertEqual((existing.product_name, existing.stock_quantity), ('Existing product', 7))

    def test_add_fictional_products_refuses_existing_unlabeled_match(self):
        Product.objects.create(product_name='Office Desk', category='Furniture', unit_price='100.00', stock_quantity=2)
        with self.assertRaises(CommandError):
            call_command('add_fictional_products', apply=True, confirm_database=connection.settings_dict['NAME'], stdout=io.StringIO())
        self.assertEqual(Product.objects.count(), 1)

    def test_existing_demo_label_cannot_be_duplicated_under_another_prefix(self):
        Product.objects.create(product_name='[DEMO] Office Desk', category='Furniture', unit_price='100.00', stock_quantity=2)
        with self.assertRaises(CommandError):
            call_command('add_fictional_products', apply=True, confirm_database=connection.settings_dict['NAME'], stdout=io.StringIO())
        self.assertEqual(Product.objects.count(), 1)
