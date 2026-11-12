"""Safe catalog administration; inventory and order transitions use business services."""
from django import forms
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import transaction
from rest_framework.exceptions import ValidationError as ApiValidationError
from .models import Supplier, Product, PurchaseOrder, PurchaseOrderItem
from .api.serializers import SupplierSerializer, ProductSerializer
from .services import transition_order, Conflict


def trusted(request):
    return request.user.is_active and (request.user.is_superuser or request.user.groups.filter(name='System Administrator').exists())


class ValidatedCatalogForm(forms.ModelForm):
    serializer_class = None
    def clean(self):
        data = super().clean()
        if self.errors:
            return data
        serializer = self.serializer_class(instance=self.instance if self.instance.pk else None, data={key: value for key, value in data.items() if key in self.catalog_fields})
        try:
            serializer.is_valid(raise_exception=True)
        except ApiValidationError as error:
            raise ValidationError(str(error.detail)) from None
        data.update(serializer.validated_data)
        return data


class SupplierForm(ValidatedCatalogForm):
    catalog_fields = ['supplier_name', 'email', 'phone', 'address']
    serializer_class = SupplierSerializer
    class Meta:
        model = Supplier
        fields = ['supplier_name', 'email', 'phone', 'address']


class ProductForm(ValidatedCatalogForm):
    catalog_fields = ['product_name', 'category', 'unit_price']
    serializer_class = ProductSerializer
    class Meta:
        model = Product
        fields = ['product_name', 'category', 'unit_price']


class BusinessReadOnly(admin.ModelAdmin):
    actions = None
    list_per_page = 25
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return False
    def has_view_permission(self, request, obj=None):
        return trusted(request)


class CatalogAdmin(BusinessReadOnly):
    def has_add_permission(self, request):
        return trusted(request)
    def has_change_permission(self, request, obj=None):
        return trusted(request)
    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            # Save serializer-approved fields only. Never save a stale stock value.
            instance = self.model.objects.select_for_update().get(pk=obj.pk) if change else None
            serializer = form.serializer_class(instance=instance, data={key: form.cleaned_data[key] for key in form.catalog_fields})
            serializer.is_valid(raise_exception=True)
            saved = serializer.save()
            obj.pk = saved.pk
            obj._state.adding = False
            obj._state.db = saved._state.db


@admin.register(Supplier)
class SupplierAdmin(CatalogAdmin):
    form = SupplierForm
    list_display = ['supplier_id', 'supplier_name', 'email', 'phone']
    list_display_links = ['supplier_id', 'supplier_name']
    search_fields = ['supplier_name', 'email', 'phone', 'address']
    readonly_fields = ['supplier_id']


@admin.register(Product)
class ProductAdmin(CatalogAdmin):
    form = ProductForm
    list_display = ['product_id', 'product_name', 'category', 'unit_price', 'stock_quantity']
    list_display_links = ['product_id', 'product_name']
    search_fields = ['product_name', 'category']
    list_filter = ['category']
    readonly_fields = ['product_id', 'stock_quantity']


class OrderItemsInline(admin.TabularInline):
    model = PurchaseOrderItem
    fields = ['product', 'quantity', 'unit_price']
    readonly_fields = fields
    extra = 0
    can_delete = False
    def has_add_permission(self, request, obj=None):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_view_permission(self, request, obj=None):
        return trusted(request)


@admin.register(PurchaseOrder)
class OrderAdmin(BusinessReadOnly):
    list_display = ['order_id', 'supplier_name', 'order_date', 'status', 'expected_delivery_date']
    list_select_related = ['supplier']
    @admin.display(description='Supplier', ordering='supplier__supplier_name')
    def supplier_name(self, obj):
        return obj.supplier.supplier_name
    list_filter = ['status', 'order_date']
    search_fields = ['=order_id', 'supplier__supplier_name']
    inlines = [OrderItemsInline]
    actions = ['approve_orders', 'deliver_orders', 'cancel_orders']
    def get_actions(self, request):
        return super().get_actions(request) if trusted(request) else {}
    def apply_transition(self, request, queryset, target):
        completed = 0
        for pk in queryset.order_by('pk').values_list('pk', flat=True):
            try:
                with transaction.atomic():
                    transition_order(pk, target)
                    self.log_change(request, self.model.objects.get(pk=pk), 'Workflow transition to ' + target)
                completed += 1
            except (Conflict, ApiValidationError):
                self.message_user(request, f'Order {pk} cannot transition to {target}; no inventory changes were applied for that order.', messages.WARNING)
        self.message_user(request, f'{completed} order(s) transitioned to {target}.', messages.SUCCESS)
    @admin.action(description='Approve eligible Pending orders')
    def approve_orders(self, request, queryset):
        if trusted(request): self.apply_transition(request, queryset, PurchaseOrder.Status.APPROVED)
    @admin.action(description='Deliver eligible Approved orders (receive stock once)')
    def deliver_orders(self, request, queryset):
        if trusted(request): self.apply_transition(request, queryset, PurchaseOrder.Status.DELIVERED)
    @admin.action(description='Cancel eligible orders')
    def cancel_orders(self, request, queryset):
        if trusted(request): self.apply_transition(request, queryset, PurchaseOrder.Status.CANCELLED)


@admin.register(PurchaseOrderItem)
class ItemAdmin(BusinessReadOnly):
    list_display = ['item_id', 'order_id', 'product_name', 'quantity', 'unit_price']
    list_select_related = ['product']
    @admin.display(description='Product', ordering='product__product_name')
    def product_name(self, obj):
        return obj.product.product_name
    search_fields = ['=order__order_id', 'product__product_name']

admin.site.site_header = 'Jedel.Group administration'
admin.site.site_title = 'Jedel.Group ERP'
admin.site.index_title = 'Accounts, catalog and purchasing workflows'


from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from .accounts import ROLES

class ApplicantFilter(admin.SimpleListFilter):
    title = 'Registration review'
    parameter_name = 'registration_review'
    def lookups(self, request, model_admin):
        return [('pending', 'Pending / inactive nonstaff accounts')]
    def queryset(self, request, queryset):
        if self.value() == 'pending':
            return queryset.filter(is_active=False, is_staff=False, is_superuser=False)
        return queryset

class TeamUserAdmin(UserAdmin):
    def has_module_permission(self, request):
        return trusted(request) and super().has_module_permission(request)
    def has_view_permission(self, request, obj=None):
        return trusted(request) and super().has_view_permission(request, obj)
    def has_add_permission(self, request):
        return trusted(request) and super().has_add_permission(request)
    def has_change_permission(self, request, obj=None):
        return trusted(request) and super().has_change_permission(request, obj) and (request.user.is_superuser or obj is None or not obj.is_superuser)
    def has_delete_permission(self, request, obj=None):
        return trusted(request) and super().has_delete_permission(request, obj) and (obj is None or (obj.pk != request.user.pk and (request.user.is_superuser or not obj.is_superuser)))
    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset if request.user.is_superuser else queryset.filter(is_superuser=False)
    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if not request.user.is_superuser:
            fields += ['is_superuser', 'user_permissions']
            if obj and (obj.pk == request.user.pk or obj.is_superuser):
                fields += ['groups', 'is_staff', 'is_active']
        return fields
    list_display = ['username', 'email', 'first_name', 'is_active', 'is_staff']
    list_filter = [ApplicantFilter, 'is_active', 'is_staff', 'groups']
    actions = ['approve_accounts', 'reject_accounts']
    @admin.action(description='Approve assigned nonstaff accounts', permissions=['change'])
    def approve_accounts(self, request, queryset):
        if not trusted(request): return
        count = 0
        for pk in queryset.filter(is_staff=False, is_superuser=False).exclude(pk=request.user.pk).values_list('pk', flat=True):
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=pk)
                if not user.groups.filter(name__in=ROLES).exists():
                    self.message_user(request, f'Account {pk} needs an application role before approval.', messages.WARNING)
                    continue
                user.is_active = True; user.save(update_fields=['is_active'])
                self.log_change(request, user, 'Approved assigned account')
                count += 1
        self.message_user(request, f'{count} account(s) approved.', messages.SUCCESS)
    @admin.action(description='Reject / suspend nonstaff accounts', permissions=['change'])
    def reject_accounts(self, request, queryset):
        if not trusted(request): return
        count = 0
        for pk in queryset.filter(is_staff=False, is_superuser=False).exclude(pk=request.user.pk).values_list('pk', flat=True):
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=pk)
                user.is_active = False; user.save(update_fields=['is_active'])
                self.log_change(request, user, 'Rejected or suspended account')
                count += 1
        self.message_user(request, f'{count} account(s) disabled; records retained.', messages.SUCCESS)

admin.site.unregister(User)
admin.site.register(User, TeamUserAdmin)

# Raw Django auth permissions alone never authorize delegated role administration.
from django.contrib.auth.models import Group
from django.contrib.auth.admin import GroupAdmin

class TeamGroupAdmin(GroupAdmin):
    def has_module_permission(self, request):
        return trusted(request) and super().has_module_permission(request)
    def has_view_permission(self, request, obj=None):
        return trusted(request) and super().has_view_permission(request, obj)
    def has_add_permission(self, request):
        return trusted(request) and super().has_add_permission(request)
    def has_change_permission(self, request, obj=None):
        return trusted(request) and super().has_change_permission(request, obj)
    def has_delete_permission(self, request, obj=None):
        return trusted(request) and super().has_delete_permission(request, obj)

admin.site.unregister(Group)
admin.site.register(Group, TeamGroupAdmin)
