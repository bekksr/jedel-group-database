"""Preview or add bound fictional order fixtures without changing existing business rows."""
import os
from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone
from apps.purchasing.models import Product, Supplier, PurchaseOrder, PurchaseOrderItem
from .seed_demo import ORDER_FIXTURES, ORDER_ITEM_PRICES, BASE_ORDER_KEYS


class Command(BaseCommand):
    help = 'Preview or apply safe demo-order additions in an explicitly isolated database.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if os.getenv('JEDEL_ISOLATED_DEVELOPMENT') != '1' or connection.settings_dict['NAME'] != 'jedel_dev':
            raise CommandError('Requires explicitly isolated jedel_dev; no changes made.')
        from apps.demo_identity.models import DemoOrderBinding, DemoItemBinding
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(%s)', [74832911])
            if options['apply']:
                cursor.execute('LOCK TABLE purchase_orders, purchase_order_items, products, suppliers, demo_identity_demoorderbinding, demo_identity_demoitembinding IN SHARE ROW EXCLUSIVE MODE')
        keys = [fixture['key'] for fixture in ORDER_FIXTURES]
        if len(keys) != len(set(keys)) or not BASE_ORDER_KEYS.issubset(keys):
            raise CommandError('Invalid or missing permanent fixture identities; no changes made.')
        bindings = {binding.key: binding for binding in DemoOrderBinding.objects.all()}
        missing_baseline = BASE_ORDER_KEYS - set(bindings)
        if missing_baseline:
            self.stdout.write('Conflict: legacy demo orders have no complete reviewed bindings; no order additions are permitted. Unbound local orders are never guessed.')
            return
        pending_orders = pending_items = skipped = 0
        conflicts = [f'{key}: bound order is absent from the current fixture; preserved' for key in sorted(set(bindings) - set(keys))]
        for fixture in ORDER_FIXTURES:
            key = fixture['key']
            names = fixture['products']
            prices = ORDER_ITEM_PRICES.get(key, [])
            if len(names) != len(set(names)) or len(prices) != len(names) or any(price < 0 for price in prices) or fixture['status'] not in PurchaseOrder.Status.values or fixture['quantity'] < 1:
                raise CommandError('Invalid order fixture ' + key + '; no changes made.')
            supplier = Supplier.objects.filter(email=fixture['supplier']).first()
            products = []
            for name in names:
                matches = list(Product.objects.filter(product_name='[DEMO] ' + name)[:2])
                if len(matches) != 1:
                    conflicts.append(f'{key}: missing or ambiguous product {name}')
                else:
                    products.append(matches[0])
            if not supplier or len(products) != len(names):
                conflicts.append(f'{key}: unresolved fixture dependencies')
                continue
            binding = bindings.get(key)
            if binding is None or (binding.order_id is None and binding.reviewed_missing):
                pending_orders += 1
                pending_items += len(products)
                self.stdout.write(f'Pending new demo order: {key}, supplier {fixture["supplier"]}, status {fixture["status"]}, date {fixture["days_ago"]} days before today; stock unchanged')
                for index, product in enumerate(products, start=1):
                    self.stdout.write(f'  {key}/line-{index:02d}: {product.product_name}, quantity {fixture["quantity"]}, unit price {prices[index - 1]} KZT')
                if options['apply']:
                    ordered = timezone.localdate() - timedelta(days=fixture['days_ago'])
                    order = PurchaseOrder.objects.create(supplier=supplier, order_date=ordered, expected_delivery_date=ordered + timedelta(days=7), status=fixture['status'])
                    if binding is None:
                        binding = DemoOrderBinding.objects.create(key=key, order_id=order.pk)
                    else:
                        binding.order_id = order.pk
                        binding.reviewed_missing = False
                        binding.save(update_fields=['order_id', 'reviewed_missing'])
                    for index, product in enumerate(products, start=1):
                        item = PurchaseOrderItem.objects.create(order=order, product=product, quantity=fixture['quantity'], unit_price=prices[index - 1])
                        DemoItemBinding.objects.create(key=f'{key}/line-{index:02d}', order_binding=binding, item_id=item.pk)
                continue
            if binding.order_id is None:
                conflicts.append(f'{key}: deleted order tombstone; not recreated')
                continue
            order = PurchaseOrder.objects.filter(pk=binding.order_id).first()
            if not order:
                conflicts.append(f'{key}: bound order is unavailable')
                continue
            changed = order.supplier_id != supplier.pk or order.status != fixture['status']
            if changed:
                conflicts.append(f'{key}: supplier or status differs; existing order preserved')
            expected_item_keys = {f'{key}/line-{index:02d}' for index in range(1, len(products) + 1)}
            for retired in DemoItemBinding.objects.filter(order_binding=binding).exclude(key__in=expected_item_keys):
                conflicts.append(f'{retired.key}: bound item is absent from the current fixture; preserved')
            for index, product in enumerate(products, start=1):
                item_key = f'{key}/line-{index:02d}'
                item_binding = DemoItemBinding.objects.filter(key=item_key).first()
                if item_binding:
                    item = PurchaseOrderItem.objects.filter(pk=item_binding.item_id).first() if item_binding.item_id else None
                    if item_binding.order_binding_id != key or not item or item.order_id != order.pk or item.product_id != product.pk or item.quantity != fixture['quantity'] or item.unit_price != prices[index - 1]:
                        conflicts.append(f'{item_key}: changed, missing or ambiguous item; preserved')
                    else:
                        skipped += 1
                    continue
                if changed or order.status != PurchaseOrder.Status.PENDING or PurchaseOrderItem.objects.filter(order=order, product=product).exists():
                    conflicts.append(f'{item_key}: unbound or non-Pending item; review required')
                    continue
                pending_items += 1
                self.stdout.write(f'Pending new demo item: {item_key}, {product.product_name}, quantity {fixture["quantity"]}, unit price {prices[index - 1]} KZT')
                if options['apply']:
                    item = PurchaseOrderItem.objects.create(order=order, product=product, quantity=fixture['quantity'], unit_price=prices[index - 1])
                    DemoItemBinding.objects.create(key=item_key, order_binding=binding, item_id=item.pk)
        for conflict in conflicts:
            self.stdout.write('Conflict: ' + conflict)
        self.stdout.write(f"{'Inserted' if options['apply'] else 'Would insert'}: {pending_orders} orders, {pending_items} items; skipped: {skipped}; conflicts: {len(conflicts)}. No stock was changed.")
