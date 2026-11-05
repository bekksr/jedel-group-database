from django.db import transaction
from django.db.models import Sum
from rest_framework import mixins, viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from ..models import Supplier, Product, PurchaseOrder
from ..services import transition_order, Conflict
from .serializers import HealthSerializer, SupplierSerializer, ProductSerializer, OrderReadSerializer, OrderWriteSerializer
from .reports import money, purchasing_total, supplier_spending, status_distribution


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(HealthSerializer({'status': 'ok', 'service': 'Jedel.Group ERP API', 'database': 'not_checked'}).data)


class AtomicResourceViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    def perform_create(self, serializer):
        with transaction.atomic():
            serializer.save()

    def perform_update(self, serializer):
        with transaction.atomic():
            # Refresh under a row lock so catalog edits cannot overwrite stock
            # from a concurrent delivery with a previously loaded value.
            serializer.instance = type(serializer.instance).objects.select_for_update().get(pk=serializer.instance.pk)
            serializer.save()

    def perform_destroy(self, instance):
        with transaction.atomic():
            instance.delete()


class SupplierViewSet(AtomicResourceViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    search_fields = ['supplier_name', 'email', 'phone', 'address']
    ordering_fields = ['supplier_id', 'supplier_name', 'email', 'address']


class ProductViewSet(AtomicResourceViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    search_fields = ['product_name', 'category']
    ordering_fields = ['product_id', 'product_name', 'unit_price', 'stock_quantity']

    def perform_destroy(self, instance):
        with transaction.atomic():
            instance = Product.objects.select_for_update().get(pk=instance.pk)
            if instance.stock_quantity > 0:
                raise Conflict('A product with inventory cannot be deleted.')
            instance.delete()

    def get_queryset(self):
        rows = super().get_queryset()
        category = self.request.query_params.get('category')
        return rows.filter(category=category) if category else rows


def order_queryset():
    return PurchaseOrder.objects.select_related('supplier').prefetch_related('items__product')


class OrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    queryset = order_queryset()
    serializer_class = OrderReadSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['supplier__supplier_name', '=order_id']
    ordering_fields = ['order_id', 'order_date', 'expected_delivery_date', 'status']

    def get_queryset(self):
        rows = super().get_queryset()
        status = self.request.query_params.get('status')
        if status and status not in PurchaseOrder.Status.values:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'status': 'Choose Pending, Approved, Delivered, or Cancelled.'})
        return rows.filter(status=status) if status else rows

    def create(self, request, *args, **kwargs):
        serializer = OrderWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderReadSerializer(order_queryset().get(pk=order.pk)).data, status=201)

    def partial_update(self, request, *args, **kwargs):
        serializer = OrderWriteSerializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderReadSerializer(order_queryset().get(pk=order.pk)).data)

    def change_status(self, target):
        if self.request.data:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'This action accepts an empty body only.'})
        order = transition_order(self.get_object().pk, target)
        return Response(OrderReadSerializer(order_queryset().get(pk=order.pk)).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self.change_status(PurchaseOrder.Status.APPROVED)

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        return self.change_status(PurchaseOrder.Status.DELIVERED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        return self.change_status(PurchaseOrder.Status.CANCELLED)


class DashboardView(APIView):
    def get(self, request):
        from .serializers import OrderReadSerializer
        from rest_framework.exceptions import ValidationError
        try:
            threshold = int(request.query_params.get('low_stock_threshold', 20))
        except (ValueError, TypeError):
            raise ValidationError({'low_stock_threshold': 'Enter a nonnegative integer.'}) from None
        if not 0 <= threshold <= 2147483647:
            raise ValidationError({'low_stock_threshold': 'Enter a nonnegative 32-bit integer.'})
        return Response({
            'currency': 'KZT',
            'total_suppliers': Supplier.objects.count(), 'total_products': Product.objects.count(),
            'total_purchase_orders': PurchaseOrder.objects.count(),
            'total_purchasing_value': money(purchasing_total()),
            'delivered_order_value': money(purchasing_total(PurchaseOrder.Status.DELIVERED)),
            'status_distribution': status_distribution(), 'supplier_spending': supplier_spending(),
            'recent_orders': OrderReadSerializer(order_queryset()[:5], many=True).data,
            'stock_overview': {'total_units': Product.objects.aggregate(total=Sum('stock_quantity'))['total'] or 0, 'low_stock_threshold': threshold, 'low_stock_products': ProductSerializer(Product.objects.filter(stock_quantity__lte=threshold), many=True).data},
        })


class SupplierSpendingView(APIView):
    def get(self, request):
        return Response({'currency': 'KZT', 'excludes_cancelled': True, 'results': supplier_spending()})


class OrderStatusView(APIView):
    def get(self, request):
        return Response({'results': status_distribution()})


class AccessView(APIView):
    def get(self, request):
        return Response({'can_write': bool(request.user.can_write), 'authentication': 'shared_bearer_token', 'role_based_security': True, 'role': request.user.role, 'capabilities': request.user.capabilities})
