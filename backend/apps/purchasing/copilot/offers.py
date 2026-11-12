"""Request-scoped, human-approved quotations. No persistence or model arithmetic."""
import csv
import io
from datetime import timedelta, timezone as dt_timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from ..models import Supplier, Product
from .tools import require, validated
from .validation import CompareInput

COLUMNS = ('product_id', 'supplier_id', 'unit_price', 'currency', 'unit', 'available_quantity',
           'min_order_quantity', 'delivery_cost', 'delivery_days', 'quoted_at', 'valid_until', 'source', 'reference', 'specifications')
UNIT_ALIASES = {'unit': 'unit', 'units': 'unit', 'piece': 'unit', 'pieces': 'unit', 'pc': 'unit', 'pcs': 'unit'}


def amount(value):
    try:
        value = Decimal(value)
        if not value.is_finite() or value < 0 or value > Decimal('99999999.99') or value != value.quantize(Decimal('.01')):
            raise ValueError()
        return value
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError('Money must be nonnegative, finite, at most 99999999.99 and have at most two decimal places.') from None


def integer(value, minimum=0, maximum=1000000):
    if not value.isascii() or not value.isdecimal() or not minimum <= int(value) <= maximum:
        raise ValueError('Invalid whole-number quantity or delivery time.')
    return int(value)


def instant(value):
    try:
        result = parse_datetime(value)
        if result is None or timezone.is_naive(result): raise ValueError()
        return result.astimezone(dt_timezone.utc)
    except (ValueError, TypeError, OverflowError):
        raise ValueError('Quotation timestamps must be ISO8601 with timezone.') from None


def compare_supplier_offers(user, **arguments):
    require(user)
    data = validated(CompareInput, arguments)
    get_object_or_404(Product.objects.only('product_id'), pk=data['product_id'])
    now = timezone.now()
    csv_text = data['csv']
    if len(csv_text.encode('utf-8')) > 65536 or '\x00' in csv_text:
        raise ValidationError({'csv': 'CSV must be UTF-8 text under 64 KiB without NUL bytes.'})
    if not csv_text.strip():
        return {'results': [], 'best_reference': None, 'warnings': ['No approved quotations supplied. No live offers or marketplace prices were queried.']}
    try:
        reader = csv.DictReader(io.StringIO(csv_text.removeprefix('\ufeff')), strict=True)
        if reader.fieldnames != list(COLUMNS):
            raise ValidationError({'csv': 'Use the documented columns in their exact order.'})
        rows = []
        for index, row in enumerate(reader, 2):
            if len(rows) >= 50: raise ValidationError({'csv': 'At most 50 quotation rows are allowed.'})
            if None in row or None in row.values(): raise ValueError('Wrong number of CSV fields.')
            row = {key: value.strip() for key, value in row.items()}
            if any(len(value) > 500 or any(ord(char) < 32 for char in value) for value in row.values()):
                raise ValueError('CSV cells must be single-line text under 500 characters.')
            for key in ('source', 'reference', 'specifications'):
                if not row[key] or row[key].startswith(('=', '+', '-', '@')):
                    raise ValueError('Source, reference and specifications are required and cannot be spreadsheet formulas.')
            if integer(row['product_id'], 1, 2147483647) != data['product_id']:
                raise ValueError('Every quotation must reference the selected product ID.')
            row['supplier_id'] = integer(row['supplier_id'], 1, 2147483647)
            row['price'] = amount(row['unit_price'])
            row['shipping'] = amount(row['delivery_cost'])
            row['available'] = integer(row['available_quantity'])
            row['minimum'] = integer(row['min_order_quantity'], 1)
            row['days'] = integer(row['delivery_days'], 0, 3650)
            row['quoted'] = instant(row['quoted_at'])
            row['expiry'] = instant(row['valid_until']) if row['valid_until'] else None
            if row['quoted'] > now or (row['expiry'] and row['expiry'] < row['quoted']):
                raise ValueError('Quotation timestamps are future-dated or have invalid validity periods.')
            row['currency'] = row['currency'].upper()
            if row['currency'] not in {'KZT', 'USD', 'EUR', 'GBP'}: raise ValueError('Unsupported currency.')
            row['normalized_unit'] = UNIT_ALIASES.get(row['unit'].lower())
            if row['normalized_unit'] is None: raise ValueError('Only whole-item unit/piece/pc quotations are supported; no pack conversion is inferred.')
            rows.append(row)
    except (ValueError, csv.Error, OverflowError):
        # Never echo arbitrary quotation cells or parser exceptions into a response.
        raise ValidationError({'csv': 'Invalid quotation row. Check IDs, field lengths, nonnegative two-decimal costs, whole quantities, units and timezone-aware dates.'}) from None
    if len({row['currency'] for row in rows}) > 1:
        raise ValidationError({'csv': 'Mixed currencies cannot be ranked without a verified FX rate; provide one currency per comparison.'})
    if len({(row['supplier_id'], row['reference']) for row in rows}) != len(rows):
        raise ValidationError({'csv': 'Duplicate supplier/reference quotation.'})
    suppliers = dict(Supplier.objects.filter(pk__in=[row['supplier_id'] for row in rows]).values_list('supplier_id', 'supplier_name'))
    if any(row['supplier_id'] not in suppliers for row in rows):
        raise ValidationError({'csv': 'Every quotation must reference an existing authorized supplier.'})
    results = []
    for row in rows:
        warnings, excluded = [], []
        if row['quoted'] < now - timedelta(days=30): excluded.append('Quotation older than 30 days; refresh before purchasing.')
        if row['expiry'] and row['expiry'] < now: excluded.append('Quotation expired.')
        if not row['expiry']: warnings.append('Validity end is unspecified.')
        if row['available'] < data['quantity']: excluded.append('Insufficient quoted availability.')
        if row['minimum'] > data['quantity']: excluded.append('Below minimum order quantity.')
        if data.get('max_delivery_days') is not None and row['days'] > data['max_delivery_days']: excluded.append('Delivery exceeds requested limit.')
        subtotal = row['price'] * data['quantity']
        total = subtotal + row['shipping']
        results.append({'reference': row['reference'], 'supplier_id': row['supplier_id'], 'supplier_name': suppliers[row['supplier_id']],
                        'currency': row['currency'], 'unit': row['normalized_unit'], 'unit_price': format(row['price'], '.2f'),
                        'quantity': data['quantity'], 'subtotal': format(subtotal, '.2f'), 'delivery_cost': format(row['shipping'], '.2f'),
                        'total': format(total, '.2f'), 'effective_unit_cost': format((total / data['quantity']).quantize(Decimal('.0001'), rounding=ROUND_HALF_UP), '.4f'),
                        'delivery_days': row['days'], 'available_quantity': row['available'], 'min_order_quantity': row['minimum'],
                        'quoted_at': row['quoted'].isoformat(), 'valid_until': row['expiry'].isoformat() if row['expiry'] else None,
                        'source': row['source'], 'specifications': row['specifications'], 'eligible': not excluded, 'warnings': warnings + excluded})
    results.sort(key=lambda row: (not row['eligible'], Decimal(row['total']), row['delivery_days'], row['supplier_id'], row['reference']))
    eligible = [row for row in results if row['eligible']]
    for index, row in enumerate(eligible, 1): row['rank'] = index
    return {'results': results, 'best_reference': eligible[0]['reference'] if eligible else None,
            'best_supplier_id': eligible[0]['supplier_id'] if eligible else None,
            'imported_at': now.isoformat(), 'source_type': 'User-supplied approved quotations; not independently supplier-verified.',
            'ranking_reason': 'Lowest eligible total = quantity × unit price + delivery cost. Delivery days break cost ties; no reliability score is inferred.',
            'assumptions': ['Human confirmed product/specification equivalence and source approval.', 'Unit aliases mean individual items; no pack or FX conversion.',
                            'Quoted price and delivery are assumed tax-inclusive; taxes must be confirmed with supplier.', 'Availability and freshness are supplier assertions, not live inventory.'],
            'warnings': [] if eligible else ['No eligible current quotations meet the requested quantity and delivery constraints.']}
