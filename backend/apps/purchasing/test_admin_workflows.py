from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from .tests import FixtureMixin
from .models import Supplier, Product, PurchaseOrder

class AdminWorkflowTests(FixtureMixin, TestCase):
    def setUp(self):
        self.seed()
        self.admin = User.objects.create_superuser('catalog-admin', password='Admin-test-only-password-941!xyz')
        self.client.force_authenticate(user=None)
        self.client.force_login(self.admin)

    def test_catalog_category_edits_do_not_change_stock_or_allow_deletion(self):
        self.assertEqual(self.client.get('/admin/purchasing/product/').status_code, 200)
        response = self.client.post(f'/admin/purchasing/product/{self.product.pk}/change/', {'product_name': 'Changed through admin', 'category': 'Admin category', 'unit_price': '12.50', 'stock_quantity': '9999', '_save': 'Save'}, format='multipart')
        self.assertEqual(response.status_code, 302)
        self.product.refresh_from_db()
        self.assertEqual(self.product.category, 'Admin category')
        self.assertEqual(self.product.stock_quantity, 5)
        self.assertEqual(self.product.unit_price, Decimal('12.50'))
        self.assertEqual(self.client.post(f'/admin/purchasing/product/{self.product.pk}/delete/', {'post': 'yes'}, format='multipart').status_code, 403)

    def test_supplier_creation_and_validation_reuse_api_rules(self):
        response = self.client.post('/admin/purchasing/supplier/add/', {'supplier_name': 'Admin supplier', 'email': 'admin-supplier@example.test', 'phone': '', 'address': '', '_save': 'Save'}, format='multipart')
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Supplier.objects.filter(email='admin-supplier@example.test').exists())
        response = self.client.post('/admin/purchasing/supplier/add/', {'supplier_name': 'Duplicate', 'email': 'ADMIN-SUPPLIER@example.test', 'phone': '', 'address': '', '_save': 'Save'}, format='multipart')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Supplier.objects.filter(email__iexact='admin-supplier@example.test').count(), 1)

    def test_admin_order_actions_receive_inventory_once_and_deny_raw_edits(self):
        from .api.serializers import OrderWriteSerializer
        serializer = OrderWriteSerializer(data=self.draft())
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        url = '/admin/purchasing/purchaseorder/'
        for action in ['approve_orders', 'deliver_orders', 'deliver_orders']:
            response = self.client.post(url, {'action': action, '_selected_action': [str(order.pk)], 'index': '0'}, format='multipart')
            self.assertEqual(response.status_code, 302)
        order.refresh_from_db(); self.product.refresh_from_db()
        self.assertEqual(order.status, 'Delivered')
        self.assertEqual(self.product.stock_quantity, 7)
        response = self.client.post(f'/admin/purchasing/purchaseorder/{order.pk}/change/', {'status': 'Pending', '_save': 'Save'}, format='multipart')
        self.assertEqual(response.status_code, 403)
        order.refresh_from_db(); self.assertEqual(order.status, 'Delivered')

    def test_nonstaff_cannot_administer_and_items_are_readonly(self):
        from django.contrib import admin
        from django.test import RequestFactory
        from .models import PurchaseOrderItem
        employee = User.objects.create_user('nonstaff-admin-test')
        self.client.force_login(employee)
        self.assertEqual(self.client.get('/admin/purchasing/product/').status_code, 302)
        request = RequestFactory().get('/admin/'); request.user = self.admin
        model_admin = admin.site._registry[PurchaseOrderItem]
        self.assertFalse(model_admin.has_change_permission(request))
        self.assertFalse(model_admin.has_add_permission(request))
        self.assertFalse(model_admin.has_delete_permission(request))
