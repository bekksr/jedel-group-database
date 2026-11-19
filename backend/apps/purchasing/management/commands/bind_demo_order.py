"""Explicitly bind a reviewed legacy order and its lines; never infer identity."""
import os
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from apps.purchasing.models import Product, PurchaseOrder, PurchaseOrderItem
from .seed_demo import ORDER_FIXTURES, ORDER_ITEM_PRICES


class Command(BaseCommand):
    help = 'Preview or explicitly bind a reviewed legacy demo order and every fixture line.'

    def add_arguments(self, parser):
        parser.add_argument('--key', required=True)
        parser.add_argument('--order-id', required=True, type=int)
        parser.add_argument('--item', action='append', default=[], help='Explicit line key and item ID, e.g. demo-order-01/line-01=12')
        parser.add_argument('--missing-item', action='append', default=[], help='Reviewed missing fixture line key; Pending orders only')
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if os.getenv('JEDEL_ISOLATED_DEVELOPMENT') != '1' or connection.settings_dict['NAME'] != 'jedel_dev':
            raise CommandError('Requires explicitly isolated jedel_dev; no changes made.')
        if options['apply'] and not options['confirm']:
            raise CommandError('Explicit --confirm is required with --apply.')
        from apps.demo_identity.models import DemoOrderBinding, DemoItemBinding
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(%s)', [74832911])
            if options['apply']:
                cursor.execute('LOCK TABLE purchase_orders, purchase_order_items, products, demo_identity_demoorderbinding, demo_identity_demoitembinding IN SHARE ROW EXCLUSIVE MODE')
        fixture = next((f for f in ORDER_FIXTURES if f['key'] == options['key']), None)
        if fixture is None:
            raise CommandError('Unknown fixture key.')
        order = PurchaseOrder.objects.filter(pk=options['order_id']).select_related('supplier').first()
        if not order or order.supplier.email != fixture['supplier']:
            raise CommandError('Order not found or its supplier does not match; review manually.')
        expected = {f"{fixture['key']}/line-{i:02d}": '[DEMO] ' + name for i, name in enumerate(fixture['products'], start=1)}
        provided = {}
        for entry in options['item']:
            key, sep, raw = entry.partition('=')
            if not sep or not raw.isdigit() or key in provided:
                raise CommandError('Each --item must contain a unique fixture-line-key=item-id.')
            provided[key] = int(raw)
        missing = options['missing_item']
        if (len(missing) != len(set(missing)) or set(provided) & set(missing)
                or set(provided) | set(missing) != set(expected) or len(set(provided.values())) != len(provided)):
            raise CommandError('Provide each fixture line exactly once as --item or --missing-item, with distinct local IDs.')
        if missing and order.status != PurchaseOrder.Status.PENDING:
            raise CommandError('Missing lines may only be added to a reviewed Pending order.')
        pending = {}
        for key in missing:
            products = list(Product.objects.filter(product_name=expected[key])[:2])
            if len(products) != 1 or DemoItemBinding.objects.filter(key=key).exists() or PurchaseOrderItem.objects.filter(order=order, product=products[0]).exists():
                raise CommandError('Missing line has an ambiguous product or an existing order item; review manually.')
            pending[key] = products[0]
        for key, item_id in provided.items():
            item = PurchaseOrderItem.objects.filter(pk=item_id, order=order).select_related('product').first()
            if not item or item.product.product_name != expected[key]:
                raise CommandError('Item does not belong to the order or its product differs; review manually.')
            if DemoItemBinding.objects.filter(key=key).exists() or DemoItemBinding.objects.filter(item_id=item_id).exists():
                raise CommandError('Line key or item ID is already bound; no changes made.')
        if DemoOrderBinding.objects.filter(key=fixture['key']).exists() or DemoOrderBinding.objects.filter(order_id=order.pk).exists():
            raise CommandError('Fixture key or order ID is already bound; no changes made.')
        self.stdout.write(f"Reviewed mapping: {fixture['key']} -> order #{order.pk}, status {order.status}; {len(provided)} explicitly selected lines. No business fields will change.")
        for key, item_id in provided.items():
            self.stdout.write(f'{key} -> item #{item_id}')
        for key, product in pending.items():
            index = int(key.rsplit('-', 1)[-1]) - 1
            self.stdout.write(f'{key} -> reviewed missing item for {product.product_name}, quantity {fixture["quantity"]}, unit price {ORDER_ITEM_PRICES[fixture["key"]][index]} KZT')
        if options['apply']:
            binding = DemoOrderBinding.objects.create(key=fixture['key'], order_id=order.pk)
            DemoItemBinding.objects.bulk_create([DemoItemBinding(key=key, order_binding=binding, item_id=value) for key, value in provided.items()])
            for key, product in pending.items():
                index = int(key.rsplit('-', 1)[-1]) - 1
                item = PurchaseOrderItem.objects.create(order=order, product=product, quantity=fixture['quantity'], unit_price=ORDER_ITEM_PRICES[fixture['key']][index])
                DemoItemBinding.objects.create(key=key, order_binding=binding, item_id=item.pk)
            self.stdout.write('Binding saved. Existing order and item values and stock were not changed.')
        else:
            self.stdout.write('Preview only. Re-run with --apply --confirm after reviewing every ID.')
