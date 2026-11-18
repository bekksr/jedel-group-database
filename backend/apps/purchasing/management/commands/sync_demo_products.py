"""Preview or append the five new fictional products to the earlier isolated demo."""
import os
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from apps.purchasing.models import Product, Supplier
from .seed_demo import CATALOG, EXTRA_PRODUCTS


class Command(BaseCommand):
    help = 'Preview or add missing versioned demo products to an existing isolated demo; never update rows.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if os.getenv('JEDEL_ISOLATED_DEVELOPMENT') != '1' or connection.settings_dict['NAME'] != 'jedel_dev':
            raise CommandError('Requires explicitly isolated jedel_dev; no changes made.')
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(%s)', [74832911])
            if options['apply']:
                cursor.execute('LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE')
        if not Supplier.objects.filter(supplier_name='[DEMO] Fictional Office Supply', email='office@example.test').exists():
            raise CommandError('Original fictional demo marker missing; no changes made.')
        original = ['[DEMO] ' + name for entries in CATALOG.values() for name, _ in entries]
        current = list(Product.objects.filter(product_name__in=original).values_list('product_name', flat=True))
        if len(current) != len(original) or set(current) != set(original):
            raise CommandError('Original demo products are missing or ambiguous; review manually.')
        pending = []
        for index, (category, name, price) in enumerate(EXTRA_PRODUCTS, start=50):
            label = '[DEMO] ' + name
            matches = Product.objects.filter(product_name=label).count()
            if matches > 1:
                raise CommandError('Duplicate demo label detected; no changes made.')
            if not matches:
                pending.append(Product(product_name=label, category=category, unit_price=price, stock_quantity=(index * 13 % 90) + 3))
        if options['apply']:
            Product.objects.bulk_create(pending)
        else:
            for product in pending:
                self.stdout.write(f'{product.product_name} | {product.category} | {product.unit_price} KZT | stock {product.stock_quantity}')
        self.stdout.write(f"{'Added' if options['apply'] else 'Would add'} {len(pending)} demo products; existing rows are unchanged.")
