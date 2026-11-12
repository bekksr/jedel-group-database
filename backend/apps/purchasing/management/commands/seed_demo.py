"""Fictional catalog only; no users, historical orders or receipt replay."""
import os
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from apps.purchasing.models import Supplier, Product, PurchaseOrder, PurchaseOrderItem


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
            self.stdout.write('Demo marker exists. No records changed or duplicated.')
            return
        if any(model.objects.exists() for model in (Supplier, Product, PurchaseOrder, PurchaseOrderItem)):
            raise CommandError('Business tables are not empty. Refusing to mix demo data with existing records.')
        Supplier.objects.create(supplier_name='[DEMO] Fictional Office Supply', email='fictional-office@example.test')
        Product.objects.create(product_name='[DEMO] Office Laptop', category='Electronics', unit_price='150000.00', stock_quantity=10)
        Product.objects.create(product_name='[DEMO] Desk Keyboard', category='Accessories', unit_price='8000.00', stock_quantity=5)
        self.stdout.write('Fictional demo: 1 supplier, 2 products, no orders or users. Initial stock is explicitly demo opening inventory; no receipts replayed.')
