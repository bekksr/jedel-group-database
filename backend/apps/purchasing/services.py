"""Atomic business writes. Views never update order status or inventory directly."""
from datetime import date
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, ValidationError
from .models import Supplier, Product, PurchaseOrder, PurchaseOrderItem

MAX_INTEGER = 2147483647


class Conflict(APIException):
    status_code = 409
    default_detail = 'This operation conflicts with the current resource state.'
    default_code = 'conflict'


def validate_dates(order_date, expected_delivery_date):
    if not isinstance(order_date, date):
        raise ValidationError({'order_date': 'Enter a valid order date.'})
    if expected_delivery_date is not None and not isinstance(expected_delivery_date, date):
        raise ValidationError({'expected_delivery_date': 'Enter a valid delivery date.'})
    if expected_delivery_date and expected_delivery_date < order_date:
        raise ValidationError({'expected_delivery_date': 'Expected delivery cannot precede order date.'})


def prepare_items(items, previous=None):
    if not items:
        raise ValidationError({'items': 'An order must contain at least one item.'})
    ids = [item['product_id'] for item in items]
    if len(ids) != len(set(ids)):
        raise ValidationError({'items': 'A product cannot appear twice in one order.'})
    # Lock in a consistent order to avoid deadlocks across overlapping deliveries.
    products = {p.pk: p for p in Product.objects.select_for_update().filter(pk__in=ids).order_by('pk')}
    if len(products) != len(ids):
        raise ValidationError({'items': 'Every item must reference an existing product.'})
    previous = previous or {}
    prepared = []
    for item in items:
        quantity = item['quantity']
        if type(quantity) is not int or not 1 <= quantity <= MAX_INTEGER:
            raise ValidationError({'items': 'Quantities must be positive 32-bit whole numbers.'})
        product = products[item['product_id']]
        price = item.get('unit_price', previous.get(product.pk, product.unit_price))
        try:
            price = Decimal(str(price))
            valid = price.is_finite() and Decimal('0') <= price <= Decimal('99999999.99') and price == price.quantize(Decimal('0.01'))
        except (InvalidOperation, ValueError, TypeError):
            valid = False
        if not valid:
            raise ValidationError({'items': 'Unit price must be nonnegative with at most two decimal places.'})
        prepared.append({'product': product, 'quantity': quantity, 'unit_price': price})
    return prepared


@transaction.atomic
def create_order(*, supplier_id, order_date, expected_delivery_date=None, items):
    validate_dates(order_date, expected_delivery_date)
    supplier = Supplier.objects.select_for_update().filter(pk=supplier_id).first()
    if supplier is None:
        raise ValidationError({'supplier_id': 'Select an existing supplier.'})
    prepared = prepare_items(items)
    order = PurchaseOrder.objects.create(supplier=supplier, order_date=order_date, expected_delivery_date=expected_delivery_date)
    PurchaseOrderItem.objects.bulk_create([PurchaseOrderItem(order=order, **item) for item in prepared])
    return order


@transaction.atomic
def amend_order(order_id, changes):
    order = get_object_or_404(PurchaseOrder.objects.select_for_update(), pk=order_id)
    if order.status != PurchaseOrder.Status.PENDING:
        raise Conflict('Only Pending orders can be amended.')
    order_date = changes.get('order_date', order.order_date)
    expected = changes.get('expected_delivery_date', order.expected_delivery_date)
    validate_dates(order_date, expected)
    supplier_id = changes.get('supplier_id', order.supplier_id)
    supplier = Supplier.objects.select_for_update().filter(pk=supplier_id).first()
    if supplier is None:
        raise ValidationError({'supplier_id': 'Select an existing supplier.'})
    if 'items' in changes:
        previous = dict(order.items.values_list('product_id', 'unit_price'))
        prepared = prepare_items(changes['items'], previous)
        order.items.all().delete()
        PurchaseOrderItem.objects.bulk_create([PurchaseOrderItem(order=order, **item) for item in prepared])
    order.supplier = supplier
    order.order_date = order_date
    order.expected_delivery_date = expected
    order.save(update_fields=['supplier', 'order_date', 'expected_delivery_date'])
    return order


@transaction.atomic
def transition_order(order_id, target):
    order = get_object_or_404(PurchaseOrder.objects.select_for_update(), pk=order_id)
    allowed = {
        PurchaseOrder.Status.PENDING: {PurchaseOrder.Status.APPROVED, PurchaseOrder.Status.CANCELLED},
        PurchaseOrder.Status.APPROVED: {PurchaseOrder.Status.DELIVERED, PurchaseOrder.Status.CANCELLED},
    }
    if target not in allowed.get(order.status, set()):
        raise Conflict(f'Cannot change an order from {order.status} to {target}.')
    if target == PurchaseOrder.Status.APPROVED and not order.items.exists():
        raise Conflict('An empty order cannot be approved.')
    if target == PurchaseOrder.Status.DELIVERED:
        lines = list(order.items.order_by('product_id'))
        if not lines:
            raise Conflict('An empty order cannot be delivered.')
        products = {p.pk: p for p in Product.objects.select_for_update().filter(pk__in=[i.product_id for i in lines]).order_by('pk')}
        for item in lines:
            product = products.get(item.product_id)
            if product is None or item.quantity <= 0 or product.stock_quantity > MAX_INTEGER - item.quantity:
                raise Conflict('Delivery cannot be applied to the current inventory.')
        for item in lines:
            updated = Product.objects.filter(pk=item.product_id, stock_quantity__lte=MAX_INTEGER - item.quantity).update(stock_quantity=F('stock_quantity') + item.quantity)
            if updated != 1:
                raise Conflict('Inventory changed; delivery was rolled back.')
    order.status = target
    order.save(update_fields=['status'])
    return order
