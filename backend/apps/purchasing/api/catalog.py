"""Public-safe product browsing, isolated from private purchasing APIs."""
from rest_framework import filters, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from ..models import Product, Supplier, PurchaseOrder
from .serializers import PublicProductSerializer, PublicSupplierSerializer, PublicOrderSerializer

PUBLIC_FIELDS = ('product_id', 'product_name', 'category')

class PublicProductViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ['get', 'head', 'options']
    serializer_class = PublicProductSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product_name', 'category']
    ordering_fields = PUBLIC_FIELDS
    ordering = ['product_id']

    def get_queryset(self):
        params = self.request.query_params
        unsupported = set(params) - {'search', 'category', 'ordering', 'page', 'format'}
        if unsupported:
            raise ValidationError({'detail': 'Only search, category, ordering and page filters are supported.'})
        if len(params.get('search', '')) > 100 or len(params.get('category', '')) > 50:
            raise ValidationError({'detail': 'Search or category is too long.'})
        ordering = params.get('ordering')
        if ordering and any(field.lstrip('-') not in PUBLIC_FIELDS for field in ordering.split(',')):
            raise ValidationError({'ordering': 'Only public catalog fields can be used for ordering.'})
        rows = Product.objects.only(*PUBLIC_FIELDS).order_by('product_id')
        category = params.get('category')
        return rows.filter(category=category) if category else rows

class PublicCategoryView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ['get', 'head', 'options']

    def get(self, request):
        if set(request.query_params) - {'format'}:
            raise ValidationError({'detail': 'This endpoint does not accept filters.'})
        categories = Product.objects.exclude(category__isnull=True).exclude(category='').order_by('category').values_list('category', flat=True).distinct()
        return Response({'results': list(categories)})


class PublicRecordsViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ['get', 'head', 'options']
    filter_backends = []

    def _check_params(self):
        if set(self.request.query_params) - {'page', 'format'}:
            raise ValidationError({'detail': 'Only pagination is supported for public records.'})


class PublicSupplierViewSet(PublicRecordsViewSet):
    serializer_class = PublicSupplierSerializer
    def get_queryset(self):
        self._check_params()
        return Supplier.objects.only('supplier_id', 'supplier_name').order_by('supplier_id')


class PublicOrderViewSet(PublicRecordsViewSet):
    serializer_class = PublicOrderSerializer
    def get_queryset(self):
        self._check_params()
        return PurchaseOrder.objects.select_related('supplier').prefetch_related('items__product').order_by('order_id')
