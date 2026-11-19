import io
import os
from unittest.mock import patch
from django.core.management import call_command, CommandError
from django.db import connection
from django.test import TestCase
from apps.demo_identity.models import DemoOrderBinding, DemoItemBinding
from .models import Product, PurchaseOrder, PurchaseOrderItem
from .management.commands.seed_demo import ORDER_FIXTURES, ORDER_ITEM_PRICES


class DemoOrderSyncTests(TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {'JEDEL_ISOLATED_DEVELOPMENT': '1'})
        self.database = patch.dict(connection.settings_dict, {'NAME': 'jedel_dev'})
        self.environment.start(); self.database.start()
        self.addCleanup(self.database.stop); self.addCleanup(self.environment.stop)
        call_command('seed_demo', confirm=True, stdout=io.StringIO())

    def stock(self):
        return list(Product.objects.order_by('pk').values_list('pk', 'stock_quantity'))

    def test_fresh_and_repeated_sync_preserves_ids_and_stock(self):
        self.assertEqual((Product.objects.count(), PurchaseOrder.objects.count(), PurchaseOrderItem.objects.count()), (55, 8, 24))
        self.assertEqual((DemoOrderBinding.objects.count(), DemoItemBinding.objects.count()), (8, 24))
        before = (self.stock(), list(PurchaseOrder.objects.values_list('pk', flat=True)), list(PurchaseOrderItem.objects.values_list('pk', flat=True)))
        for apply in (False, True, True):
            call_command('sync_demo_orders', apply=apply, stdout=io.StringIO())
        self.assertEqual(before, (self.stock(), list(PurchaseOrder.objects.values_list('pk', flat=True)), list(PurchaseOrderItem.objects.values_list('pk', flat=True))))

    def test_metadata_foreign_keys_are_enforced(self):
        with connection.cursor() as cursor:
            for table, name in [('demo_identity_demoorderbinding', 'demo_order_binding_order_fk'), ('demo_identity_demoitembinding', 'demo_item_binding_item_fk')]:
                constraints = connection.introspection.get_constraints(cursor, table)
                self.assertTrue(constraints[name]['foreign_key'])

    def test_metadata_models_match_the_committed_migration(self):
        call_command('makemigrations', 'demo_identity', check=True, dry_run=True, stdout=io.StringIO())

    def test_nonisolated_database_is_rejected(self):
        with patch.dict(connection.settings_dict, {'NAME': 'jedel_group_db'}):
            with self.assertRaises(CommandError): call_command('sync_demo_orders', apply=True, stdout=io.StringIO())

    def test_new_fixture_preview_apply_and_repeat(self):
        before = self.stock()
        new = {'key': 'demo-order-09', 'supplier': 'office@example.test', 'status': 'Delivered', 'days_ago': 4, 'products': ['Notebook Campus 13'], 'quantity': 2}
        with patch('apps.purchasing.management.commands.sync_demo_orders.ORDER_FIXTURES', ORDER_FIXTURES + [new]), patch('apps.purchasing.management.commands.sync_demo_orders.ORDER_ITEM_PRICES', {**ORDER_ITEM_PRICES, 'demo-order-09': [225000]}):
            preview = io.StringIO(); call_command('sync_demo_orders', stdout=preview)
            self.assertIn('Would insert: 1 orders, 1 items', preview.getvalue())
            self.assertEqual(PurchaseOrder.objects.count(), 8)
            call_command('sync_demo_orders', apply=True, stdout=io.StringIO())
            call_command('sync_demo_orders', apply=True, stdout=io.StringIO())
        self.assertEqual((PurchaseOrder.objects.count(), PurchaseOrderItem.objects.count()), (9, 25))
        self.assertEqual(self.stock(), before)
        self.assertEqual(PurchaseOrder.objects.get(pk=DemoOrderBinding.objects.get(key='demo-order-09').order_id).status, 'Delivered')

    def test_user_changes_and_deleted_line_are_conflicts(self):
        binding = DemoOrderBinding.objects.get(key='demo-order-01')
        order = PurchaseOrder.objects.get(pk=binding.order_id)
        item = PurchaseOrderItem.objects.get(pk=DemoItemBinding.objects.get(key='demo-order-01/line-01').item_id)
        item.quantity = 99; item.unit_price = '123.00'; item.save(update_fields=['quantity', 'unit_price'])
        deleted = DemoItemBinding.objects.get(key='demo-order-01/line-02')
        PurchaseOrderItem.objects.filter(pk=deleted.item_id).delete()
        before = self.stock()
        out = io.StringIO(); call_command('sync_demo_orders', apply=True, stdout=out)
        item.refresh_from_db(); deleted.refresh_from_db(); order.refresh_from_db()
        self.assertEqual(item.quantity, 99); self.assertEqual(str(item.unit_price), '123.00'); self.assertIsNone(deleted.item_id)
        self.assertIn('changed, missing or ambiguous', out.getvalue())
        self.assertEqual(PurchaseOrderItem.objects.count(), 23)
        self.assertEqual(self.stock(), before)

    def test_changed_item_price_is_reported_and_not_replaced(self):
        binding = DemoItemBinding.objects.get(key='demo-order-01/line-01')
        item = PurchaseOrderItem.objects.get(pk=binding.item_id)
        item.unit_price = '123.00'; item.save(update_fields=['unit_price'])
        out = io.StringIO(); call_command('sync_demo_orders', apply=True, stdout=out)
        item.refresh_from_db()
        self.assertEqual(str(item.unit_price), '123.00')
        self.assertIn('demo-order-01/line-01: changed, missing or ambiguous', out.getvalue())

    def test_new_fixture_line_only_added_to_bound_pending_order(self):
        before = self.stock()
        fixture = {**ORDER_FIXTURES[0], 'products': ORDER_FIXTURES[0]['products'] + ['Notebook Campus 13']}
        with patch('apps.purchasing.management.commands.sync_demo_orders.ORDER_FIXTURES', [fixture] + ORDER_FIXTURES[1:]), patch('apps.purchasing.management.commands.sync_demo_orders.ORDER_ITEM_PRICES', {**ORDER_ITEM_PRICES, 'demo-order-01': ORDER_ITEM_PRICES['demo-order-01'] + [225000]}):
            preview = io.StringIO(); call_command('sync_demo_orders', stdout=preview)
            self.assertIn('Would insert: 0 orders, 1 items', preview.getvalue())
            call_command('sync_demo_orders', apply=True, stdout=io.StringIO())
            call_command('sync_demo_orders', apply=True, stdout=io.StringIO())
        self.assertEqual(PurchaseOrderItem.objects.count(), 25)
        self.assertTrue(DemoItemBinding.objects.filter(key='demo-order-01/line-04').exists())
        self.assertEqual(self.stock(), before)

    def test_new_line_for_approved_order_is_a_conflict(self):
        fixture = {**ORDER_FIXTURES[1], 'products': ORDER_FIXTURES[1]['products'] + ['Notebook Campus 13']}
        with patch('apps.purchasing.management.commands.sync_demo_orders.ORDER_FIXTURES', [ORDER_FIXTURES[0], fixture] + ORDER_FIXTURES[2:]), patch('apps.purchasing.management.commands.sync_demo_orders.ORDER_ITEM_PRICES', {**ORDER_ITEM_PRICES, 'demo-order-02': ORDER_ITEM_PRICES['demo-order-02'] + [225000]}):
            out = io.StringIO(); call_command('sync_demo_orders', apply=True, stdout=out)
        self.assertIn('non-Pending item', out.getvalue())
        self.assertEqual(PurchaseOrderItem.objects.count(), 24)

    def test_unbound_legacy_records_are_never_guessed(self):
        DemoItemBinding.objects.all().delete(); DemoOrderBinding.objects.all().delete()
        before = (PurchaseOrder.objects.count(), PurchaseOrderItem.objects.count(), self.stock())
        out = io.StringIO(); call_command('sync_demo_orders', apply=True, stdout=out)
        self.assertIn('no complete reviewed bindings', out.getvalue())
        self.assertEqual(before, (PurchaseOrder.objects.count(), PurchaseOrderItem.objects.count(), self.stock()))

    def test_reviewed_binding_requires_explicit_ids_and_confirmation(self):
        DemoItemBinding.objects.all().delete(); DemoOrderBinding.objects.all().delete()
        order = PurchaseOrder.objects.order_by('pk').first()
        lines = list(order.items.order_by('pk'))
        mapping = [f'demo-order-01/line-{i:02d}={item.pk}' for i, item in enumerate(lines, start=1)]
        args = {'key': 'demo-order-01', 'order_id': order.pk, 'item': mapping, 'stdout': io.StringIO()}
        call_command('bind_demo_order', **args)
        self.assertFalse(DemoOrderBinding.objects.exists())
        with self.assertRaises(CommandError): call_command('bind_demo_order', apply=True, **args)
        call_command('bind_demo_order', apply=True, confirm=True, **args)
        self.assertEqual((DemoOrderBinding.objects.count(), DemoItemBinding.objects.count()), (1, 3))

    def test_transaction_rolls_back_new_order_on_line_failure(self):
        new = {'key': 'demo-order-09', 'supplier': 'office@example.test', 'status': 'Pending', 'days_ago': 4, 'products': ['Notebook Campus 13'], 'quantity': 2}
        with patch('apps.purchasing.management.commands.sync_demo_orders.ORDER_FIXTURES', ORDER_FIXTURES + [new]), patch('apps.purchasing.management.commands.sync_demo_orders.ORDER_ITEM_PRICES', {**ORDER_ITEM_PRICES, 'demo-order-09': [225000]}), patch('apps.demo_identity.models.DemoItemBinding.objects.create', side_effect=RuntimeError('simulated failure')):
            with self.assertRaises(RuntimeError): call_command('sync_demo_orders', apply=True, stdout=io.StringIO())
        self.assertEqual((PurchaseOrder.objects.count(), PurchaseOrderItem.objects.count()), (8, 24))
        self.assertFalse(DemoOrderBinding.objects.filter(key='demo-order-09').exists())

    def test_reviewed_absent_legacy_order_can_be_added_once_and_tombstones_stay_deleted(self):
        binding = DemoOrderBinding.objects.get(key='demo-order-01')
        order = PurchaseOrder.objects.get(pk=binding.order_id)
        DemoItemBinding.objects.filter(order_binding=binding).delete(); binding.delete()
        order.items.all().delete(); order.delete()
        before = self.stock()
        call_command('mark_demo_order_missing', key='demo-order-01', stdout=io.StringIO())
        self.assertFalse(DemoOrderBinding.objects.filter(key='demo-order-01').exists())
        with self.assertRaises(CommandError):
            call_command('mark_demo_order_missing', key='demo-order-01', apply=True, stdout=io.StringIO())
        call_command('mark_demo_order_missing', key='demo-order-01', apply=True, confirm_reviewed_absent=True, stdout=io.StringIO())
        call_command('sync_demo_orders', apply=True, stdout=io.StringIO())
        call_command('sync_demo_orders', apply=True, stdout=io.StringIO())
        binding = DemoOrderBinding.objects.get(key='demo-order-01')
        self.assertFalse(binding.reviewed_missing)
        self.assertEqual((PurchaseOrder.objects.count(), PurchaseOrderItem.objects.count()), (8, 24))
        order = PurchaseOrder.objects.get(pk=binding.order_id)
        order.items.all().delete(); order.delete()
        binding.refresh_from_db(); self.assertIsNone(binding.order_id)
        out = io.StringIO(); call_command('sync_demo_orders', apply=True, stdout=out)
        self.assertIn('deleted order tombstone', out.getvalue())
        self.assertEqual(PurchaseOrder.objects.count(), 7)
        self.assertEqual(self.stock(), before)

    def test_reviewed_missing_line_is_added_only_to_pending_order(self):
        binding = DemoOrderBinding.objects.get(key='demo-order-01')
        order = PurchaseOrder.objects.get(pk=binding.order_id)
        DemoItemBinding.objects.all().delete(); DemoOrderBinding.objects.all().delete()
        lines = list(order.items.order_by('pk'))
        lines[2].delete()
        before = self.stock()
        args = {'key': 'demo-order-01', 'order_id': order.pk,
                'item': [f'demo-order-01/line-{i:02d}={item.pk}' for i, item in enumerate(lines[:2], start=1)],
                'missing_item': ['demo-order-01/line-03'], 'stdout': io.StringIO()}
        call_command('bind_demo_order', **args)
        self.assertEqual(PurchaseOrderItem.objects.count(), 23)
        call_command('bind_demo_order', apply=True, confirm=True, **args)
        self.assertEqual(PurchaseOrderItem.objects.count(), 24)
        self.assertEqual(self.stock(), before)
