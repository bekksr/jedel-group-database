"""Optional, explicitly approved additions; never update or delete existing rows."""
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction
from decimal import Decimal
from apps.purchasing.management.commands.seed_demo import CATALOG, EXTRA_PRODUCTS
from apps.purchasing.models import Product


class Command(BaseCommand):
    help = 'Preview or add uniquely labeled fictional products without changing existing rows.'

    def add_arguments(self, parser):
        parser.add_argument('--database', default='default')
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-database', default='')
        parser.add_argument('--expected-additions', type=int)

    def handle(self, *args, **options):
        alias = options['database']
        conn = connections[alias]
        name = conn.settings_dict['NAME']
        if options['apply'] and options['confirm_database'] != name:
            raise CommandError('To write, --confirm-database must exactly match the configured database name.')
        with transaction.atomic(using=alias):
            if options['apply']:
                with conn.cursor() as cursor:
                    cursor.execute('LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE')
            entries = [(category, product, price) for category, rows in CATALOG.items() for product, price in rows] + list(EXTRA_PRODUCTS)
            names = [f'[JEDEL FICTIONAL] {product}' for _, product, _ in entries]
            existing = list(Product.objects.using(alias).filter(product_name__in=names).values_list('product_name', flat=True))
            if len(existing) != len(set(existing)):
                raise CommandError('Duplicate fictional labels already exist; review manually. No rows were changed.')
            present = set(existing)
            indexed = {p.product_name: p for p in Product.objects.using(alias).filter(product_name__in=names)}
            existing_names = set()
            for value in Product.objects.using(alias).values_list('product_name', flat=True):
                normalized = value.strip()
                if normalized.startswith('[JEDEL FICTIONAL] '):
                    continue
                if normalized.startswith('[DEMO] '):
                    normalized = normalized[len('[DEMO] '):]
                existing_names.add(normalized.casefold().strip())
            conflicts = [product for _, product, _ in entries if product.casefold().strip() in existing_names]
            if conflicts:
                raise CommandError('Unlabeled existing products match fictional names; review before adding: ' + ', '.join(conflicts))
            pending = []
            conflicts = []
            index = 0
            for category, product, price in entries:
                label = f'[JEDEL FICTIONAL] {product}'
                if label not in present:
                    pending.append(Product(product_name=label, category=category, unit_price=price, stock_quantity=(index * 13 % 90) + 3))
                elif indexed[label].category != category or indexed[label].unit_price != Decimal(price):
                    conflicts.append(label)
                index += 1
            if options['expected_additions'] is not None and len(pending) != options['expected_additions']:
                raise CommandError('The proposed additions changed since preview; no rows were changed.')
            if options['apply']:
                Product.objects.using(alias).bulk_create(pending)
            else:
                self.stdout.write('Exact proposed additions (name | category | unit price KZT | opening stock):')
                for product in pending:
                    self.stdout.write(f'{product.product_name} | {product.category} | {product.unit_price}.00 | {product.stock_quantity}')
            for label in conflicts:
                self.stdout.write('Conflict (preserved): ' + label)
            self.stdout.write(f"Database {name}: {len(present) - len(conflicts)} skipped, {len(conflicts)} conflicts; {'added' if options['apply'] else 'would add'} {len(pending)} fictional products. Existing rows were not changed.")
