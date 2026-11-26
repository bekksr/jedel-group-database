"""Shared catalog synchronization preserves local inventory and transactions."""
import io
import os
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.purchasing.models import Product, PurchaseOrder, PurchaseOrderItem, Supplier


class SharedCatalogSyncTests(TestCase):
    @override_settings(DEBUG=True)
    def test_add_update_and_repeat_sync_are_idempotent(self):
        old_shared = Product.objects.create(
            product_name="[DEMO] Notebook Air 13",
            category="Laptops",
            unit_price=245000,
            stock_quantity=9,
        )
        local_product = Product.objects.create(
            product_name="Local spare item",
            category="Local",
            unit_price=1000,
            stock_quantity=4,
        )
        supplier = Supplier.objects.create(
            supplier_name="Old shared supplier name",
            email="techno@example.com",
        )
        order = PurchaseOrder.objects.create(
            supplier=supplier,
            order_date="2026-11-01",
            status="Pending",
        )
        item = PurchaseOrderItem.objects.create(
            order=order,
            product=old_shared,
            quantity=2,
            unit_price=245000,
        )

        with patch.dict(os.environ, {"JEDEL_ISOLATED_DEVELOPMENT": "1"}), patch.dict(
            "django.db.connection.settings_dict", {"NAME": "jedel_dev"}
        ):
            call_command("sync_shared_catalog", stdout=io.StringIO())
            call_command("sync_shared_catalog", stdout=io.StringIO())

        old_shared.refresh_from_db()
        local_product.refresh_from_db()
        supplier.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(Product.objects.count(), 56)
        self.assertEqual(old_shared.product_name, "Notebook Air 13")
        self.assertEqual(old_shared.stock_quantity, 9)
        self.assertEqual(local_product.stock_quantity, 4)
        self.assertEqual(supplier.supplier_name, "TechnoSupply")
        self.assertEqual(PurchaseOrder.objects.count(), 1)
        self.assertEqual(PurchaseOrderItem.objects.count(), 1)
        self.assertEqual(item.product_id, old_shared.pk)
        self.assertEqual(item.unit_price, 245000)
