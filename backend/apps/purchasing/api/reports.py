from decimal import Decimal
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce
from ..models import Supplier, Product, PurchaseOrder, PurchaseOrderItem


def money(value):
    return format(value, '.2f')


def line_expression():
    return ExpressionWrapper(F('quantity') * F('unit_price'), output_field=DecimalField(max_digits=32, decimal_places=2))


def purchasing_total(status=None):
    rows = PurchaseOrderItem.objects.exclude(order__status=PurchaseOrder.Status.CANCELLED)
    if status:
        rows = rows.filter(order__status=status)
    return rows.aggregate(total=Coalesce(Sum(line_expression()), Value(Decimal('0.00')), output_field=DecimalField(max_digits=32, decimal_places=2)))['total']


def supplier_spending():
    rows = PurchaseOrderItem.objects.exclude(order__status=PurchaseOrder.Status.CANCELLED).values('order__supplier_id').annotate(total=Sum(line_expression()))
    values = {r['order__supplier_id']: r['total'] for r in rows}
    counts = dict(PurchaseOrder.objects.exclude(status=PurchaseOrder.Status.CANCELLED).values('supplier_id').annotate(count=Count('order_id')).values_list('supplier_id', 'count'))
    return sorted([{'supplier_id': s.pk, 'supplier_name': s.supplier_name, 'total': money(values.get(s.pk, Decimal('0.00'))), 'order_count': counts.get(s.pk, 0)} for s in Supplier.objects.all()], key=lambda row: Decimal(row['total']), reverse=True)


def status_distribution():
    counts = dict(PurchaseOrder.objects.values('status').annotate(count=Count('order_id')).values_list('status', 'count'))
    return [{'status': status, 'count': counts.get(status, 0)} for status in PurchaseOrder.Status.values]
