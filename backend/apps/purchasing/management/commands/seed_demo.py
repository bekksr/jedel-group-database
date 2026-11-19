"""Seed fictional opening inventory and illustrative orders into an empty dev database."""
import os
from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone
from apps.purchasing.models import Supplier, Product, PurchaseOrder, PurchaseOrderItem


CATALOG = {
    'Laptops': [('Notebook Air 13', 245000), ('Notebook Pro 14', 390000), ('Notebook Work 15', 315000), ('Notebook Study 14', 210000), ('Notebook Mobile 16', 470000)],
    'Monitors': [('Monitor 22 FHD', 62000), ('Monitor 24 FHD', 78000), ('Monitor 27 QHD', 145000), ('Monitor 32 UHD', 235000), ('Monitor 29 Wide', 175000)],
    'Accessories': [('Wireless Mouse', 6500), ('USB Keyboard', 8500), ('Webcam HD', 19000), ('USB Hub', 12500), ('Laptop Stand', 15500)],
    'Networking': [('Gigabit Router', 32000), ('Wi-Fi Access Point', 45000), ('Network Switch 8 Port', 28000), ('Network Switch 24 Port', 95000), ('Ethernet Cable 5m', 2500)],
    'Storage': [('SSD 256GB', 22000), ('SSD 512GB', 35000), ('SSD 1TB', 59000), ('USB Drive 64GB', 6500), ('External Drive 2TB', 58000)],
    'Printers': [('Laser Printer Mono', 85000), ('Laser Printer Color', 185000), ('Inkjet Printer', 68000), ('Document Scanner', 115000), ('Label Printer', 74000)],
    'Furniture': [('Office Desk', 78000), ('Ergo Mesh Office Chair', 65000), ('Filing Cabinet', 89000), ('Meeting Table', 155000), ('Mobile Pedestal', 42000)],
    'Office Supplies': [('Paper A4 Box', 12500), ('Notebook Pack', 4800), ('Pen Pack', 3200), ('Stapler', 3900), ('Document Folder Pack', 5600)],
    'Audio': [('Office Headset', 18500), ('Conference Speaker', 69000), ('Desktop Speakers', 24000), ('USB Microphone', 35000), ('Wireless Headphones', 42000)],
    'Power': [('UPS 650VA', 35000), ('UPS 1000VA', 58000), ('Surge Protector', 8500), ('Power Strip', 5500), ('Laptop Charger', 16500)],
}

# Additional fictional records for the versioned 55-product education dataset.
EXTRA_PRODUCTS = [
    ('Laptops', 'Notebook Campus 13', 225000),
    ('Monitors', 'Monitor 25 QHD', 110000),
    ('Accessories', 'Ergonomic Mouse', 12500),
    ('Networking', 'Wi-Fi Mesh Node', 38000),
    ('Storage', 'External SSD 1TB', 72000),
]

DEMO_SUPPLIERS = [
    ('[DEMO] Fictional Office Supply', 'office@example.test'),
    ('[DEMO] Steppe Computing', 'computing@example.test'),
    ('[DEMO] Nomad Workspace', 'workspace@example.test'),
    ('[DEMO] Tulpar Networks', 'networks@example.test'),
]

# Keys are permanent identities, independent of order IDs and mutable fields.
ORDER_FIXTURES = [
    {'key': 'demo-order-01', 'supplier': 'office@example.test', 'status': 'Pending', 'days_ago': 70, 'products': ['Notebook Air 13', 'Notebook Pro 14', 'Notebook Work 15'], 'quantity': 2},
    {'key': 'demo-order-02', 'supplier': 'computing@example.test', 'status': 'Approved', 'days_ago': 62, 'products': ['Monitor 22 FHD', 'Monitor 24 FHD', 'Monitor 27 QHD'], 'quantity': 3},
    {'key': 'demo-order-03', 'supplier': 'workspace@example.test', 'status': 'Delivered', 'days_ago': 54, 'products': ['Wireless Mouse', 'USB Keyboard', 'Webcam HD'], 'quantity': 4},
    {'key': 'demo-order-04', 'supplier': 'networks@example.test', 'status': 'Cancelled', 'days_ago': 46, 'products': ['Gigabit Router', 'Wi-Fi Access Point', 'Network Switch 8 Port'], 'quantity': 5},
    {'key': 'demo-order-05', 'supplier': 'office@example.test', 'status': 'Pending', 'days_ago': 38, 'products': ['SSD 256GB', 'SSD 512GB', 'SSD 1TB'], 'quantity': 6},
    {'key': 'demo-order-06', 'supplier': 'computing@example.test', 'status': 'Approved', 'days_ago': 30, 'products': ['Laser Printer Mono', 'Laser Printer Color', 'Inkjet Printer'], 'quantity': 7},
    {'key': 'demo-order-07', 'supplier': 'workspace@example.test', 'status': 'Delivered', 'days_ago': 22, 'products': ['Office Desk', 'Ergo Mesh Office Chair', 'Filing Cabinet'], 'quantity': 8},
    {'key': 'demo-order-08', 'supplier': 'networks@example.test', 'status': 'Cancelled', 'days_ago': 14, 'products': ['Paper A4 Box', 'Notebook Pack', 'Pen Pack'], 'quantity': 9},
]
BASE_ORDER_KEYS = frozenset(f'demo-order-{index:02d}' for index in range(1, 9))
ORDER_ITEM_PRICES = {
    'demo-order-01': [245000, 390000, 315000],
    'demo-order-02': [62000, 78000, 145000],
    'demo-order-03': [6500, 8500, 19000],
    'demo-order-04': [32000, 45000, 28000],
    'demo-order-05': [22000, 35000, 59000],
    'demo-order-06': [85000, 185000, 68000],
    'demo-order-07': [78000, 65000, 89000],
    'demo-order-08': [12500, 4800, 3200],
}


class Command(BaseCommand):
    help = 'Explicitly seed fictional records into an otherwise empty isolated jedel_dev.'

    def add_arguments(self, parser):
        parser.add_argument('--confirm', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if not options['confirm'] or os.getenv('JEDEL_ISOLATED_DEVELOPMENT') != '1' or connection.settings_dict['NAME'] != 'jedel_dev':
            raise CommandError('Requires --confirm, JEDEL_ISOLATED_DEVELOPMENT=1 and DB_NAME=jedel_dev; never jedel_group_db.')
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(%s)', [74832911])
        if Supplier.objects.filter(supplier_name='[DEMO] Fictional Office Supply').exists():
            self.stdout.write('Demo marker exists. No records changed or duplicated; existing demo sets are not upgraded automatically.')
            return
        if any(model.objects.exists() for model in (Supplier, Product, PurchaseOrder, PurchaseOrderItem)):
            raise CommandError('Business tables are not empty. Refusing to mix demo data with existing records.')
        suppliers = [Supplier.objects.create(supplier_name=name, email=email) for name, email in DEMO_SUPPLIERS]
        products = []
        for category, entries in CATALOG.items():
            for name, price in entries:
                index = len(products)
                products.append(Product.objects.create(product_name='[DEMO] ' + name, category=category,
                    unit_price=Decimal(price), stock_quantity=(index * 13 % 90) + 3))
        for category, name, price in EXTRA_PRODUCTS:
            index = len(products)
            products.append(Product.objects.create(product_name='[DEMO] ' + name, category=category,
                unit_price=Decimal(price), stock_quantity=(index * 13 % 90) + 3))
        from apps.demo_identity.models import DemoOrderBinding, DemoItemBinding
        today = timezone.localdate()
        suppliers_by_email = {supplier.email: supplier for supplier in suppliers}
        products_by_name = {product.product_name: product for product in products}
        for fixture in ORDER_FIXTURES:
            ordered = today - timedelta(days=fixture['days_ago'])
            order = PurchaseOrder.objects.create(supplier=suppliers_by_email[fixture['supplier']], order_date=ordered,
                expected_delivery_date=ordered + timedelta(days=7), status=fixture['status'])
            binding = DemoOrderBinding.objects.create(key=fixture['key'], order_id=order.pk)
            for index, name in enumerate(fixture['products'], start=1):
                product = products_by_name['[DEMO] ' + name]
                item = PurchaseOrderItem.objects.create(order=order, product=product, quantity=fixture['quantity'], unit_price=ORDER_ITEM_PRICES[fixture['key']][index - 1])
                DemoItemBinding.objects.create(key=f"{fixture['key']}/line-{index:02d}", order_binding=binding, item_id=item.pk)
        self.stdout.write('Fictional demo created: 4 suppliers, 55 products, 8 orders and 24 items. Stock is opening inventory; historical deliveries are not replayed.')
