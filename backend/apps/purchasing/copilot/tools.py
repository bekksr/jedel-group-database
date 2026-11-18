"""Bounded ORM reads; permissions apply even when called outside an API view."""
from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.db.models import Count, Sum, F, DecimalField, ExpressionWrapper
from rest_framework.exceptions import PermissionDenied
from ..accounts import capabilities
from ..models import Product, Supplier, PurchaseOrder, PurchaseOrderItem
from ..api.catalog import PUBLIC_FIELDS
from .validation import SearchInput, InventoryInput, DraftInput, StatusInput


def require(user, capability='read'):
    if not user or not user.is_authenticated or not user.is_active or not capabilities(user).get(capability):
        raise PermissionDenied('Your role does not permit this procurement tool.')


def validated(serializer, arguments):
    value = serializer(data=arguments)
    value.is_valid(raise_exception=True)
    return value.validated_data


def search_products(user, **arguments):
    data = validated(SearchInput, arguments)
    # Keep this public projection identical to the reusable catalog API. Even
    # privileged chat never transmits purchasing prices or stock to a provider.
    rows = Product.objects.only(*PUBLIC_FIELDS).order_by('product_id')
    if data['query']:
        lookup = 'product_name__iexact' if data['match'] == 'exact' else 'product_name__icontains'
        rows = rows.filter(**{lookup: data['query']})
    if data['category']:
        rows = rows.filter(category__iexact=data['category'])
    results = list(rows.values(*PUBLIC_FIELDS)[:21])
    return {'results': results[:20], 'truncated': len(results) > 20, 'source': 'PostgreSQL public-safe catalog', 'filters': data}


def get_product_details(user, product_id):
    # product_id is validated before queryset use; unknown IDs return 404.
    from rest_framework import serializers
    product_id = serializers.IntegerField(min_value=1, max_value=2147483647).run_validation(product_id)
    product = get_object_or_404(Product.objects.only(*PUBLIC_FIELDS), pk=product_id)
    return {field: getattr(product, field) for field in PUBLIC_FIELDS}


def get_authorized_inventory(user, **arguments):
    require(user)
    data = validated(InventoryInput, arguments)
    rows = Product.objects.order_by('stock_quantity', 'product_id')
    if data['category']:
        rows = rows.filter(category__iexact=data['category'])
    if data['low_only']:
        rows = rows.filter(stock_quantity__lte=data['threshold'])
    values = list(rows.values('product_id', 'product_name', 'category', 'stock_quantity')[:21])
    return {'results': values[:20], 'truncated': len(values) > 20, 'threshold': data['threshold'],
            'threshold_basis': 'Request parameter, not a stored reorder point or demand forecast.', 'source': 'PostgreSQL inventory',
            'guidance': 'Review these stock levels with your purchasing team; no demand forecast is available.'}


def supplier_options(user):
    require(user, 'create_orders')
    return {'results': list(Supplier.objects.order_by('supplier_id').values('supplier_id', 'supplier_name')[:50]),
            'note': 'Directory choices only; no supplier-product availability relationship is stored.'}


def propose_order(user, **arguments):
    require(user, 'create_orders')
    data = validated(DraftInput, arguments)
    product = get_object_or_404(Product, pk=data['product_id'])
    supplier = get_object_or_404(Supplier, pk=data['supplier_id'])
    return {'draft_only': True, 'persisted': False, 'proposed_status': 'Pending',
            'supplier': {'supplier_id': supplier.pk, 'supplier_name': supplier.supplier_name},
            'items': [{'product_id': product.pk, 'product_name': product.product_name, 'quantity': data['quantity'],
                       'unit_price': str(product.unit_price), 'subtotal': str(product.unit_price * Decimal(data['quantity']))}],
            'currency': 'KZT', 'source': 'Current internal catalog price, not a verified supplier quotation.',
            'warnings': ['Confirm the supplier sells this product; no supplier-product relation is stored.',
                         'Delivery, tax inclusion and availability are unverified. No order or stock was changed.',
                         'Use the normal order form for review and authorized creation; prices are revalidated there.']}


def get_authorized_order_status(user, **arguments):
    require(user)
    data = validated(StatusInput, arguments)
    order = get_object_or_404(PurchaseOrder, pk=data['order_id'])
    return {'order_id': order.pk, 'status': order.status, 'source': 'PostgreSQL purchase orders', 'read_only': True}


def product_advice(user, filters, action, language='en'):
    """Rank using current database values; no derived product claims or provider access."""
    require(user)
    rows = Product.objects.all()
    if filters.get('query'):
        rows = rows.filter(product_name__icontains=filters['query'])
    if filters.get('category'):
        rows = rows.filter(category__icontains=filters['category'])
    if filters.get('budget') is not None:
        rows = rows.filter(unit_price__lte=filters['budget'])
    if filters.get('in_stock') or action == 'recommend':
        rows = rows.filter(stock_quantity__gt=0)
    total = rows.count()
    limit = 2 if action == 'compare' else 1 if action in ('cheapest', 'recommend') else 10
    values = list(rows.order_by('unit_price', 'product_id').values('product_id', 'product_name', 'category', 'unit_price', 'stock_quantity')[:limit])
    if language == 'ru':
        intro = {'find': 'Подходящие товары', 'cheapest': 'Самый недорогой товар', 'compare': 'Два самых недорогих товара', 'recommend': 'Рекомендация: самый недорогой товар в наличии'}[action]
        empty = 'Нет подходящих товаров в PostgreSQL.'
        note = 'Цена и остаток — внутренние данные PostgreSQL; характеристики, отзывы и предложения поставщиков не проверены.'
    else:
        intro = {'find': 'Matching products', 'cheapest': 'Lowest-priced product', 'compare': 'Two lowest-priced products', 'recommend': 'Recommendation: lowest-priced product in stock'}[action]
        empty = 'No matching products in PostgreSQL.'
        note = 'Prices and stock are internal PostgreSQL data; specifications, reviews and supplier offers are not verified.'
    stock_label = 'остаток' if language == 'ru' else 'stock'
    lines = [f"{p['product_name']} (#{p['product_id']}), {p['category'] or '—'}: {p['unit_price']} KZT; {stock_label} {p['stock_quantity']}" for p in values]
    message = (intro + f' ({total}):\n' + '\n'.join(lines) if lines else empty) + '\n' + note
    return {'kind': 'product_advice', 'message': message, 'results': values, 'total': total, 'source': 'PostgreSQL', 'action': action}


def analytics_summary(user, language='en'):
    require(user)
    counts = {row['status']: row['count'] for row in PurchaseOrder.objects.values('status').annotate(count=Count('order_id'))}
    delivered = PurchaseOrderItem.objects.filter(order__status=PurchaseOrder.Status.DELIVERED).aggregate(
        value=Sum(ExpressionWrapper(F('quantity') * F('unit_price'), output_field=DecimalField(max_digits=20, decimal_places=2))))['value'] or Decimal('0.00')
    products = Product.objects.count()
    low = Product.objects.filter(stock_quantity__lte=20).count()
    if language == 'ru':
        message = f'Сводка PostgreSQL: товаров {products}; остаток ≤ 20: {low}; заказы по статусам {counts}; стоимость доставленных заказов {delivered} KZT. Это не подтверждение оплаты.'
    else:
        message = f'PostgreSQL summary: products {products}; stock ≤ 20: {low}; orders {counts}; delivered order value {delivered} KZT. Delivered value is not confirmed payment.'
    return {'kind': 'analytics', 'message': message, 'source': 'PostgreSQL', 'order_counts': counts, 'product_count': products, 'low_stock_count': low, 'delivered_value': str(delivered)}
