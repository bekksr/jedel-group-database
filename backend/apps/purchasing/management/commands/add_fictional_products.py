"""Optional, explicitly approved additions; never update or delete existing rows."""
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction
from apps.purchasing.management.commands.seed_demo import CATALOG
from apps.purchasing.models import Product


class Command(BaseCommand):
    help = 'Preview or add uniquely labeled fictional products without changing existing rows.'

    def add_arguments(self, parser):
        parser.add_argument('--database', default='default')
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-database', default='')

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
            names = [f'[JEDEL FICTIONAL] {product}' for entries in CATALOG.values() for product, _ in entries]
            existing = list(Product.objects.using(alias).filter(product_name__in=names).values_list('product_name', flat=True))
            if len(existing) != len(set(existing)):
                raise CommandError('Duplicate fictional labels already exist; review manually. No rows were changed.')
            present = set(existing)
            pending = []
            index = 0
            for category, entries in CATALOG.items():
                for product, price in entries:
                    label = f'[JEDEL FICTIONAL] {product}'
                    if label not in present:
                        pending.append(Product(product_name=label, category=category, unit_price=price, stock_quantity=(index * 13 % 90) + 3))
                    index += 1
            if options['apply']:
                Product.objects.using(alias).bulk_create(pending)
            self.stdout.write(f"Database {name}: {len(present)} labels already present; {'added' if options['apply'] else 'would add'} {len(pending)} fictional products. Existing rows were not changed.")
