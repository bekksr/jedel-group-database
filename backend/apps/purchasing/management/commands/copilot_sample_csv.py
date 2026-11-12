"""Generate fictional request-only test input. Never creates products/suppliers."""
import csv
from datetime import timedelta
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from apps.purchasing.copilot.offers import COLUMNS


class Command(BaseCommand):
    help = 'Write clearly fictional quotation variants using operator-supplied existing IDs; no database writes or queries.'
    def add_arguments(self, parser):
        parser.add_argument('--product-id', type=int, required=True)
        parser.add_argument('--supplier-id', type=int, required=True)
        parser.add_argument('--output', required=True)
    def handle(self, *args, **options):
        if not 1 <= options['product_id'] <= 2147483647 or not 1 <= options['supplier_id'] <= 2147483647:
            raise CommandError('Supply positive existing record IDs.')
        path = Path(options['output'])
        if path.suffix.lower() != '.csv': raise CommandError('Output must have a .csv extension.')
        if path.exists(): raise CommandError('Output already exists. Choose a new filename; no file was overwritten.')
        now = timezone.now()
        common = {'product_id': options['product_id'], 'supplier_id': options['supplier_id'], 'currency': 'KZT', 'unit': 'pcs',
                  'available_quantity': 100, 'min_order_quantity': 1, 'delivery_days': 3,
                  'quoted_at': (now-timedelta(days=1)).isoformat(), 'valid_until': (now+timedelta(days=7)).isoformat(),
                  'source': 'FICTIONAL - approved for interface testing only',
                  'specifications': 'TEST INPUT ONLY - selected product ID; no real supplier specification asserted'}
        try:
            with path.open('x', encoding='utf-8', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=COLUMNS)
                writer.writeheader()
                writer.writerows([{**common, 'reference': 'FICTIONAL-A', 'unit_price': '10.25', 'delivery_cost': '5.00'},
                                 {**common, 'reference': 'FICTIONAL-B', 'unit_price': '9.50', 'delivery_cost': '20.00'}])
        except OSError:
            raise CommandError('Cannot write the requested CSV path. No database operation was performed.') from None
        self.stdout.write('Created FICTIONAL testing input only. No database access or provider calls. For quantity 10: A=107.50 KZT; B=115.00 KZT. Never use for procurement.')
