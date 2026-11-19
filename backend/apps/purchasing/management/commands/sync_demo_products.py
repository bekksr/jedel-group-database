"""Preview or add versioned demo catalog records without changing existing rows."""
import os
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from apps.purchasing.models import Product, Supplier
from .seed_demo import CATALOG, EXTRA_PRODUCTS, DEMO_SUPPLIERS


class Command(BaseCommand):
    help = 'Preview or insert missing fictional products and suppliers in an explicitly isolated demo.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--skip-unless-demo', action='store_true', help='For launcher: skip non-isolated or unmarked databases')

    @transaction.atomic
    def handle(self, *args, **options):
        if os.getenv('JEDEL_ISOLATED_DEVELOPMENT') != '1' or connection.settings_dict['NAME'] != 'jedel_dev':
            if options['skip_unless_demo']:
                self.stdout.write('Demo sync check skipped: database is not explicitly isolated.')
                return
            raise CommandError('Requires explicitly isolated jedel_dev; no changes made.')
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(%s)', [74832911])
            if options['apply']:
                cursor.execute('LOCK TABLE products, suppliers IN SHARE ROW EXCLUSIVE MODE')
        if not Supplier.objects.filter(supplier_name='[DEMO] Fictional Office Supply', email='office@example.test').exists():
            if options['skip_unless_demo']:
                self.stdout.write('Demo sync check skipped: demo marker is absent or changed.')
                return
            raise CommandError('Original fictional demo marker missing; no changes made.')
        entries = [(category, name, price) for category, items in CATALOG.items() for name, price in items] + list(EXTRA_PRODUCTS)
        labels = ['[DEMO] ' + name for _, name, _ in entries]
        if len(labels) != len(set(labels)) or len(DEMO_SUPPLIERS) != len({email for _, email in DEMO_SUPPLIERS}):
            raise CommandError('The versioned demo contains duplicate identities; no changes made.')
        existing = {}
        other_names = set()
        for value in Product.objects.exclude(product_name__in=labels).values_list('product_name', flat=True):
            normalized = value.strip()
            if normalized.startswith('[JEDEL FICTIONAL] '):
                normalized = normalized[len('[JEDEL FICTIONAL] '):]
            other_names.add(normalized.casefold())
        for product in Product.objects.filter(product_name__in=labels):
            if product.product_name in existing:
                raise CommandError('Duplicate demo product label detected; no changes made.')
            existing[product.product_name] = product
        pending_products, pending_suppliers, conflicts = [], [], []
        skipped = 0
        for index, ((category, name, price), label) in enumerate(zip(entries, labels)):
            current = existing.get(label)
            if current is None:
                if name.casefold() in other_names:
                    conflicts.append('Another product uses this demo name: ' + label)
                else:
                    pending_products.append(Product(product_name=label, category=category, unit_price=price, stock_quantity=(index * 13 % 90) + 3))
            elif current.category != category or current.unit_price != Decimal(price):
                conflicts.append('Product changed locally or in fixture: ' + label)
            else:
                skipped += 1
        for name, email in DEMO_SUPPLIERS:
            supplier = Supplier.objects.filter(email=email).first()
            if supplier is None:
                pending_suppliers.append(Supplier(supplier_name=name, email=email))
            elif supplier.supplier_name != name:
                conflicts.append('Supplier name differs for fictional email: ' + email)
            else:
                skipped += 1
        for product in pending_products:
            self.stdout.write(f'Pending product: {product.product_name} | {product.category} | {product.unit_price} KZT | stock {product.stock_quantity}')
        for supplier in pending_suppliers:
            self.stdout.write(f'Pending supplier: {supplier.supplier_name} | {supplier.email}')
        for conflict in conflicts:
            self.stdout.write('Conflict (preserved): ' + conflict)
        if options['apply']:
            Supplier.objects.bulk_create(pending_suppliers)
            Product.objects.bulk_create(pending_products)
        self.stdout.write(f"{'Inserted' if options['apply'] else 'Would insert'}: {len(pending_products)} products, {len(pending_suppliers)} suppliers; skipped: {skipped}; conflicts: {len(conflicts)}. Existing rows and stock are unchanged.")
        self.stdout.write('Orders and order items are not synchronized: existing rows have no stable demo identity. Review them manually; none were changed.')
