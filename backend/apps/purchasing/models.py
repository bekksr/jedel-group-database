"""Manually reviewed mappings of the committed PostgreSQL 17 schema.

All business tables remain unmanaged. No schema migration is authorized here.
"""
from decimal import Decimal
from django.db import models
from django.db.models import Q, F
from django.utils import timezone


class Supplier(models.Model):
    supplier_id = models.AutoField(primary_key=True)
    supplier_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=100, unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'suppliers'
        ordering = ['supplier_id']


class Product(models.Model):
    product_id = models.AutoField(primary_key=True)
    product_name = models.CharField(max_length=100)
    category = models.CharField(max_length=50, blank=True, null=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = models.IntegerField(default=0)

    class Meta:
        managed = False
        db_table = 'products'
        ordering = ['product_id']
        constraints = [
            models.CheckConstraint(condition=Q(unit_price__gte=0), name='products_unit_price_check'),
            models.CheckConstraint(condition=Q(stock_quantity__gte=0), name='products_stock_quantity_check'),
        ]


class PurchaseOrder(models.Model):
    class Status(models.TextChoices):
        PENDING = 'Pending'
        APPROVED = 'Approved'
        DELIVERED = 'Delivered'
        CANCELLED = 'Cancelled'

    order_id = models.AutoField(primary_key=True)
    supplier = models.ForeignKey(Supplier, models.PROTECT, db_column='supplier_id', related_name='orders')
    order_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=30, choices=Status, default=Status.PENDING)
    expected_delivery_date = models.DateField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'purchase_orders'
        ordering = ['-order_date', '-order_id']
        constraints = [
            models.CheckConstraint(condition=Q(expected_delivery_date__isnull=True) | Q(expected_delivery_date__gte=F('order_date')), name='chk_delivery_date'),
            models.CheckConstraint(condition=Q(status__in=['Pending', 'Approved', 'Delivered', 'Cancelled']), name='purchase_orders_status_check'),
        ]

    @property
    def total(self):
        return sum((item.line_total for item in self.items.all()), Decimal('0.00'))


class PurchaseOrderItem(models.Model):
    item_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(PurchaseOrder, models.PROTECT, db_column='order_id', related_name='items')
    product = models.ForeignKey(Product, models.PROTECT, db_column='product_id', related_name='order_items')
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = False
        db_table = 'purchase_order_items'
        ordering = ['item_id']
        constraints = [
            models.UniqueConstraint(fields=['order', 'product'], name='uq_order_product'),
            models.CheckConstraint(condition=Q(quantity__gt=0), name='purchase_order_items_quantity_check'),
            models.CheckConstraint(condition=Q(unit_price__gte=0), name='purchase_order_items_unit_price_check'),
        ]

    @property
    def line_total(self):
        return self.unit_price * self.quantity
