from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from ..models import Supplier, Product, PurchaseOrder, PurchaseOrderItem
from .. import services
from .fields import StrictTextField, StrictEmailField, OptionalAddressField


class StrictInputMixin:
    def to_internal_value(self, data):
        if isinstance(data, dict):
            forbidden = set(data) - {name for name, field in self.fields.items() if not field.read_only}
            if forbidden:
                raise serializers.ValidationError({key: ('Stock quantity is read-only; inventory changes only through a successful delivery.' if key == 'stock_quantity' else 'Unknown or read-only field.') for key in sorted(forbidden)})
        return super().to_internal_value(data)


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()
    database = serializers.CharField()


class SupplierSerializer(StrictInputMixin, serializers.ModelSerializer):
    supplier_name = StrictTextField(max_length=100)
    email = StrictEmailField(max_length=100)
    address = OptionalAddressField()

    class Meta:
        model = Supplier
        fields = ['supplier_id', 'supplier_name', 'email', 'phone', 'address']
        read_only_fields = ['supplier_id']

    def validate_email(self, value):
        value = value.strip().lower()
        matches = Supplier.objects.filter(email__iexact=value)
        if self.instance:
            matches = matches.exclude(pk=self.instance.pk)
        if matches.exists():
            raise serializers.ValidationError('A supplier with this email already exists.')
        return value


class ProductSerializer(StrictInputMixin, serializers.ModelSerializer):
    product_name = StrictTextField(max_length=100)
    category = StrictTextField(max_length=50, required=False, allow_null=True, allow_blank=True)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.00'))

    class Meta:
        model = Product
        fields = ['product_id', 'product_name', 'category', 'unit_price', 'stock_quantity']
        read_only_fields = ['product_id', 'stock_quantity']


class OrderItemReadSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    line_total = serializers.DecimalField(max_digits=22, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = ['item_id', 'product_id', 'product_name', 'quantity', 'unit_price', 'line_total']
        read_only_fields = fields


class OrderReadSerializer(serializers.ModelSerializer):
    supplier_id = serializers.IntegerField(read_only=True)
    supplier_name = serializers.CharField(source='supplier.supplier_name', read_only=True)
    items = OrderItemReadSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=32, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = ['order_id', 'supplier_id', 'supplier_name', 'order_date', 'status', 'expected_delivery_date', 'items', 'total']
        read_only_fields = fields


class OrderItemWriteSerializer(StrictInputMixin, serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1, max_value=2147483647)
    quantity = serializers.IntegerField(min_value=1, max_value=2147483647)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.00'), required=False)


    def validate(self, attrs):
        missing = {'product_id', 'quantity'} - set(attrs)
        if missing:
            raise serializers.ValidationError({key: 'This field is required for every replacement item.' for key in missing})
        return attrs


class OrderWriteSerializer(StrictInputMixin, serializers.Serializer):
    supplier_id = serializers.IntegerField(min_value=1, max_value=2147483647)
    order_date = serializers.DateField(default=timezone.localdate)
    expected_delivery_date = serializers.DateField(allow_null=True, required=False)
    items = OrderItemWriteSerializer(many=True, allow_empty=False, max_length=500)

    def validate(self, attrs):
        order_date = attrs.get('order_date', self.instance.order_date if self.instance else None)
        expected = attrs.get('expected_delivery_date', self.instance.expected_delivery_date if self.instance else None)
        services.validate_dates(order_date, expected)
        return attrs

    def create(self, validated_data):
        return services.create_order(**validated_data)

    def update(self, instance, validated_data):
        return services.amend_order(instance.pk, validated_data)
