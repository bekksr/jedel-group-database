"""Amir's named T01-T20 acceptance tests. Never run on the application DB."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import patch
from django.db import connection, connections, transaction, IntegrityError, OperationalError
from django.db.models.query import QuerySet
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient
from config.test_runner import assert_isolated
from .tests import FixtureMixin
from .models import Supplier, Product, PurchaseOrder, PurchaseOrderItem
from .api.fields import OptionalAddressField, StrictTextField, StrictEmailField
from .api.exceptions import exception_handler
from . import services


class AmirValidationAndDeliveryTests(FixtureMixin, TestCase):
    def setUp(self):
        self.seed()

    def supplier_payload(self, **changes):
        value = {'supplier_name': 'Amir isolated test supplier', 'email': 'amir-test@example.test'}
        value.update(changes)
        return value

    def approved_order(self):
        pk = self.create()['order_id']
        self.assertEqual(self.client.post(f'/api/orders/{pk}/approve/', {}, format='json').status_code, 200)
        return pk

    def stock(self):
        return dict(Product.objects.order_by('pk').values_list('pk', 'stock_quantity'))

    def test_database_not_null_remains_final_authority(self):
        for field in ['supplier_name', 'email']:
            with self.subTest(field=field), self.assertRaises(IntegrityError):
                with transaction.atomic():
                    Supplier.objects.filter(pk=self.supplier.pk).update(**{field: None})
        self.supplier.refresh_from_db()
        self.assertTrue(self.supplier.supplier_name)
        self.assertTrue(self.supplier.email)

    def test_T01_valid_supplier_creation(self):
        result = self.client.post('/api/suppliers/', self.supplier_payload(supplier_name='  Valid test supplier  ', email='AMIR-TEST@example.test'), format='json')
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data['supplier_name'], 'Valid test supplier')
        self.assertEqual(result.data['email'], 'amir-test@example.test')
        self.assertIsNone(result.data['address'])
        self.assertTrue(Supplier.objects.filter(pk=result.data['supplier_id']).exists())

    def test_T02_duplicate_supplier_email(self):
        for email in [self.supplier.email, self.supplier.email.upper(), '  '+self.supplier.email+'  ']:
            result = self.client.post('/api/suppliers/', self.supplier_payload(email=email), format='json')
            self.assertEqual(result.status_code, 400, result.data)
            self.assertIn('email', result.data)
        self.assertEqual(Supplier.objects.count(), 1)
        self.assertEqual(self.client.patch(f'/api/suppliers/{self.supplier.pk}/', {'email': self.supplier.email}, format='json').status_code, 200)

    def test_T03_missing_supplier_name(self):
        for name in ['omitted', None, '', '   ']:
            payload = self.supplier_payload()
            if name == 'omitted': payload.pop('supplier_name')
            else: payload['supplier_name'] = name
            result = self.client.post('/api/suppliers/', payload, format='json')
            self.assertEqual(result.status_code, 400)
            self.assertIn('supplier_name', result.data)

    def test_T04_missing_supplier_email(self):
        for email in ['omitted', None, '', '   ']:
            payload = self.supplier_payload()
            if email == 'omitted': payload.pop('email')
            else: payload['email'] = email
            result = self.client.post('/api/suppliers/', payload, format='json')
            self.assertEqual(result.status_code, 400)
            self.assertIn('email', result.data)

    def test_T05_invalid_email_format(self):
        for email in ['not-email', 'missing@', '@example.test', 'a..b@example.test', 'a b@example.test', 123, True, ['a@example.test']]:
            result = self.client.post('/api/suppliers/', self.supplier_payload(email=email), format='json')
            self.assertEqual(result.status_code, 400)
            self.assertIn('email', result.data)

    def test_T06_valid_optional_address_and_patch_policy(self):
        variants = [({}, None), ({'address': None}, None), ({'address': ''}, None), ({'address': '  10 Test Street, Almaty  '}, '10 Test Street, Almaty')]
        for index, (address, expected) in enumerate(variants):
            payload = self.supplier_payload(email=f'address{index}@example.test', **address)
            result = self.client.post('/api/suppliers/', payload, format='json')
            self.assertEqual(result.status_code, 201, result.data)
            pk = result.data['supplier_id']; self.assertEqual(result.data['address'], expected)
            preserved = self.client.patch(f'/api/suppliers/{pk}/', {'phone': ''}, format='json')
            self.assertEqual(preserved.data['address'], expected)
            cleared = self.client.patch(f'/api/suppliers/{pk}/', {'address': ''}, format='json')
            self.assertEqual(cleared.status_code, 200)
            self.assertIsNone(cleared.data['address'])
            self.assertIsNone(Supplier.objects.get(pk=pk).address)

    def test_T07_whitespace_only_address(self):
        for address in [' ', '   ', '\t\r\n', '\u00a0']:
            result = self.client.post('/api/suppliers/', self.supplier_payload(address=address), format='json')
            self.assertEqual(result.status_code, 400)
            self.assertIn('address', result.data)
        original = self.supplier.address
        result = self.client.patch(f'/api/suppliers/{self.supplier.pk}/', {'address': '   '}, format='json')
        self.assertEqual(result.status_code, 400)
        self.supplier.refresh_from_db(); self.assertEqual(self.supplier.address, original)

    def test_T08_address_longer_than_255(self):
        result = self.client.post('/api/suppliers/', self.supplier_payload(address='x'*256), format='json')
        self.assertEqual(result.status_code, 400)
        self.assertIn('address', result.data)
        valid = self.client.post('/api/suppliers/', self.supplier_payload(address='x'*255), format='json')
        self.assertEqual(valid.status_code, 201)

    def test_T09_negative_product_price(self):
        for price in ['-1', '-0.01']:
            result = self.client.post('/api/products/', {'product_name': 'Invalid isolated product', 'unit_price': price}, format='json')
            self.assertEqual(result.status_code, 400)
            self.assertIn('unit_price', result.data)
        self.assertEqual(Product.objects.count(), 2)

    def test_T10_negative_stock_quantity(self):
        before = self.stock()
        result = self.client.patch(f'/api/products/{self.product.pk}/', {'stock_quantity': -1}, format='json')
        self.assertEqual(result.status_code, 400)
        self.assertIn('stock_quantity', result.data)
        self.assertIn('read-only', str(result.data['stock_quantity']))
        self.assertEqual(self.stock(), before)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Product.objects.filter(pk=self.product.pk).update(stock_quantity=-1)

    def test_T11_zero_or_negative_order_item_quantity(self):
        for quantity in [0, -1, -100]:
            result = self.client.post('/api/orders/', self.draft(items=[{'product_id': self.product.pk, 'quantity': quantity}]), format='json')
            self.assertEqual(result.status_code, 400)
        self.assertEqual(PurchaseOrder.objects.count(), 0)
        self.assertEqual(PurchaseOrderItem.objects.count(), 0)

    def test_T12_nonexistent_supplier_foreign_key(self):
        result = self.client.post('/api/orders/', self.draft(supplier_id=2147483647), format='json')
        self.assertEqual(result.status_code, 400)
        self.assertIn('supplier_id', result.data)
        self.assertEqual(PurchaseOrder.objects.count(), 0)

    def test_T13_duplicate_product_in_one_order(self):
        result = self.client.post('/api/orders/', self.draft(items=[{'product_id': self.product.pk, 'quantity': 1}, {'product_id': self.product.pk, 'quantity': 2}]), format='json')
        self.assertEqual(result.status_code, 400)
        self.assertIn('items', result.data)
        self.assertEqual(PurchaseOrderItem.objects.count(), 0)

    def test_T14_expected_delivery_before_order_date(self):
        result = self.client.post('/api/orders/', self.draft(expected_delivery_date='2026-11-05'), format='json')
        self.assertEqual(result.status_code, 400)
        self.assertIn('expected_delivery_date', result.data)

    def test_T15_approved_order_delivered_successfully(self):
        pk = self.approved_order()
        result = self.client.post(f'/api/orders/{pk}/deliver/', {}, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['status'], 'Delivered')
        self.assertEqual(PurchaseOrder.objects.get(pk=pk).status, 'Delivered')

    def test_T16_stock_increased_by_correct_quantities(self):
        pk = self.approved_order(); before = self.stock()
        result = self.client.post(f'/api/orders/{pk}/deliver/', {}, format='json')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.stock(), {self.product.pk: before[self.product.pk]+2, self.other_product.pk: before[self.other_product.pk]+3})
        self.assertEqual(result.data['total'], '28.00')

    def test_T17_second_delivery_rejected_without_stock_changes(self):
        pk = self.approved_order()
        self.assertEqual(self.client.post(f'/api/orders/{pk}/deliver/', {}, format='json').status_code, 200)
        once = self.stock()
        self.assertEqual(self.client.post(f'/api/orders/{pk}/deliver/', {}, format='json').status_code, 409)
        self.assertEqual(self.stock(), once)
        self.assertEqual(PurchaseOrder.objects.get(pk=pk).status, 'Delivered')

    def test_T18_cancelled_order_cannot_be_delivered(self):
        pk = self.create()['order_id']; services.transition_order(pk, 'Cancelled'); before = self.stock()
        self.assertEqual(self.client.post(f'/api/orders/{pk}/deliver/', {}, format='json').status_code, 409)
        self.assertEqual(self.stock(), before)
        self.assertEqual(PurchaseOrder.objects.get(pk=pk).status, 'Cancelled')

    def test_T19_atomic_rollback_on_simulated_delivery_failure(self):
        pk = self.approved_order(); before = self.stock()
        original = QuerySet.update; updates = 0
        def fail_second(queryset, **kwargs):
            nonlocal updates
            if queryset.model is Product:
                updates += 1
                if updates == 2: raise OperationalError('Simulated isolated delivery failure')
            return original(queryset, **kwargs)
        with patch.object(QuerySet, 'update', new=fail_second):
            result = self.client.post(f'/api/orders/{pk}/deliver/', {}, format='json')
        self.assertEqual(result.status_code, 503)
        self.assertEqual(updates, 2)
        self.assertEqual(self.stock(), before)
        self.assertEqual(PurchaseOrder.objects.get(pk=pk).status, 'Approved')


class AmirConcurrentDeliveryTests(FixtureMixin, TransactionTestCase):
    def clear_isolated(self):
        assert_isolated(connection)
        if connection.settings_dict['NAME'] != 'test_jedel_api':
            raise AssertionError('Refusing to clear a non-test database.')
        with connection.cursor() as cursor:
            cursor.execute('TRUNCATE purchase_order_items, purchase_orders, products, suppliers RESTART IDENTITY')

    def setUp(self):
        self.clear_isolated(); self.seed()

    def tearDown(self):
        self.clear_isolated()

    @override_settings(ERP_APPROVER_TOKEN='t20-isolated-test-approver-credential-only')
    def test_T20_concurrent_delivery_does_not_double_count(self):
        pk = self.create()['order_id']; services.transition_order(pk, 'Approved')
        from django.contrib.auth.models import User, Group
        user = User.objects.create_user('concurrent-manager')
        user.groups.add(Group.objects.get_or_create(name='Purchasing Manager')[0])
        barrier = Barrier(2, timeout=15)
        def deliver(_):
            connections.close_all()
            client = APIClient(); client.force_login(user)
            try:
                barrier.wait()
                return client.post(f'/api/orders/{pk}/deliver/', {}, format='json').status_code
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(deliver, range(2)))
        self.assertEqual(sorted(statuses), [200, 409])
        self.assertEqual(dict(Product.objects.values_list('pk', 'stock_quantity')), {self.product.pk: 7, self.other_product.pk: 5})
        self.assertEqual(PurchaseOrder.objects.get(pk=pk).status, 'Delivered')


class AmirFieldValidationTests(SimpleTestCase):
    def test_optional_address_policy_and_invalid_types_without_database(self):
        field = OptionalAddressField()
        for value in [None, '']:
            self.assertIsNone(field.run_validation(value))
        self.assertEqual(field.run_validation('  Valid multiline\naddress  '), 'Valid multiline\naddress')
        from rest_framework.exceptions import ValidationError
        for value in [123, 1.5, False, [], {}, ' ', '\t\n', 'x'*256]:
            with self.subTest(kind=type(value).__name__), self.assertRaises(ValidationError):
                field.run_validation(value)

    def test_names_and_email_reject_coercion_and_invalid_formats(self):
        from rest_framework.exceptions import ValidationError
        for field in [StrictTextField(max_length=100), StrictEmailField(max_length=100)]:
            for value in [123, 1.2, False, {}, [], None, '', ' ']:
                with self.subTest(field=type(field).__name__, kind=type(value).__name__), self.assertRaises(ValidationError):
                    field.run_validation(value)
        self.assertEqual(StrictEmailField(max_length=100).run_validation('valid@example.test'), 'valid@example.test')

    def test_database_integrity_errors_are_safe_http_400_and_delete_conflicts_stay_409(self):
        class PostgreSQLError(Exception):
            pgcode = '23505'
            diag = SimpleNamespace(constraint_name='suppliers_email_key')
        error = IntegrityError('Do not reveal SQL or connection details')
        error.__cause__ = PostgreSQLError()
        response = exception_handler(error, {'request': SimpleNamespace(method='POST')})
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)
        self.assertNotIn('SQL', str(response.data))
        self.assertEqual(exception_handler(error, {'request': SimpleNamespace(method='DELETE')}).status_code, 409)
