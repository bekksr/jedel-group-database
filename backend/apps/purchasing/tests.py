from django.test import SimpleTestCase

class ApiFoundationTests(SimpleTestCase):
    # SimpleTestCase forbids database access: these checks cannot change records.
    def test_health_does_not_claim_database_readiness(self):
        response = self.client.get('/api/v1/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['database'], 'not_checked')

    def test_allowed_angular_origin(self):
        response = self.client.get('/api/v1/health/', HTTP_ORIGIN='http://localhost:4200')
        self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:4200')

    def test_other_origin_is_not_allowed(self):
        response = self.client.get('/api/v1/health/', HTTP_ORIGIN='https://untrusted.example')
        self.assertNotIn('access-control-allow-origin', response.headers)

    def test_development_startup_can_skip_database_check(self):
        from io import StringIO
        from .management.commands.runserver import Command
        output = StringIO()
        command = Command(stdout=output)
        command.skip_migration_check = True
        command.check_migrations()
        self.assertIn('Database connectivity is not verified', output.getvalue())


# Business integration tests are run only by scripts/test_postgres.py.
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch
from django.db import connection, connections, transaction, IntegrityError, OperationalError
from django.db.models.query import QuerySet
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient
from .models import Supplier, Product, PurchaseOrder, PurchaseOrderItem
from . import services
from .api.authentication import ApiPrincipal
from config.test_runner import assert_isolated


class ApiAccessTests(SimpleTestCase):
    def test_all_business_endpoints_deny_anonymous_access_before_database_queries(self):
        client = APIClient()
        for method, path in [
            ('get', '/api/access/'), ('get', '/api/dashboard/'), ('get', '/api/suppliers/'), ('post', '/api/suppliers/'),
            ('patch', '/api/suppliers/1/'), ('delete', '/api/suppliers/1/'),
            ('get', '/api/products/'), ('post', '/api/products/'), ('get', '/api/products/1/'),
            ('patch', '/api/products/1/'), ('delete', '/api/products/1/'),
            ('get', '/api/orders/'), ('get', '/api/orders/1/'), ('post', '/api/orders/'), ('patch', '/api/orders/1/'),
            ('post', '/api/orders/1/approve/'), ('post', '/api/orders/1/deliver/'), ('post', '/api/orders/1/cancel/'),
            ('get', '/api/analytics/supplier-spending/'), ('get', '/api/analytics/order-status/'),
        ]:
            with self.subTest(path=path, method=method):
                self.assertEqual(getattr(client, method)(path, {}, format='json').status_code, 401)

    @override_settings(ERP_READ_TOKEN='r' * 40, ERP_WRITE_TOKEN='w' * 40)
    def test_read_token_cannot_write_and_invalid_token_is_denied(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + 'r' * 40)
        self.assertEqual(client.post('/api/products/', {}, format='json').status_code, 403)
        client.credentials(HTTP_AUTHORIZATION='Bearer invalid')
        self.assertEqual(client.get('/api/suppliers/').status_code, 401)

    def test_unexpected_database_errors_are_sanitized(self):
        from .api.exceptions import exception_handler
        response = exception_handler(OperationalError('host=private password=do-not-return'), {})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', str(response.data))
        self.assertNotIn('password', str(response.data))


class FixtureMixin:
    def seed(self):
        self.supplier = Supplier.objects.create(supplier_name='Test Supplier', email='supplier@example.test')
        self.product = Product.objects.create(product_name='Test Product', category='Test', unit_price=Decimal('10.25'), stock_quantity=5)
        self.other_product = Product.objects.create(product_name='Other Test Product', category='Other', unit_price=Decimal('2.50'), stock_quantity=2)
        self.client = APIClient()
        self.client.force_authenticate(user=ApiPrincipal(can_write=True))

    def draft(self, **changes):
        values = {'supplier_id': self.supplier.pk, 'order_date': '2026-11-06', 'expected_delivery_date': '2026-11-07', 'items': [{'product_id': self.product.pk, 'quantity': 2}, {'product_id': self.other_product.pk, 'quantity': 3}]}
        values.update(changes)
        return values

    def create(self, **changes):
        response = self.client.post('/api/orders/', self.draft(**changes), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data


class BusinessApiTests(FixtureMixin, TestCase):
    def setUp(self):
        self.seed()

    def test_supplier_crud_search_sort_and_unique_email(self):
        response = self.client.post('/api/suppliers/', {'supplier_name': 'New Supplier', 'email': 'new@example.test', 'phone': '+77010000000', 'address': 'Test address'}, format='json')
        self.assertEqual(response.status_code, 201)
        pk = response.data['supplier_id']
        self.assertEqual(self.client.get(f'/api/suppliers/{pk}/').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/suppliers/{pk}/', {'supplier_name': 'Updated'}, format='json').status_code, 200)
        duplicate = self.client.post('/api/suppliers/', {'supplier_name': 'Duplicate', 'email': 'NEW@example.test'}, format='json')
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(self.client.get('/api/suppliers/?search=Updated&ordering=-supplier_name').data['count'], 1)
        self.assertEqual(self.client.delete(f'/api/suppliers/{pk}/').status_code, 204)
        self.assertEqual(self.client.get(f'/api/suppliers/{pk}/').status_code, 404)

    def test_supplier_validation_and_protected_delete(self):
        for payload in [{'supplier_name': '', 'email': 'invalid'}, {'supplier_name': 'A', 'email': 'bad'}, {'supplier_name': 'A' * 101, 'email': 'a@example.test'}, {'supplier_id': 10, 'supplier_name': 'A', 'email': 'a@example.test'}]:
            self.assertEqual(self.client.post('/api/suppliers/', payload, format='json').status_code, 400)
        self.create()
        self.assertEqual(self.client.delete(f'/api/suppliers/{self.supplier.pk}/').status_code, 409)

    def test_product_crud_filters_price_validation_and_inventory_protection(self):
        response = self.client.post('/api/products/', {'product_name': 'New Product', 'category': 'New', 'unit_price': '12.75'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        pk = response.data['product_id']
        self.assertEqual(response.data['stock_quantity'], 0)
        self.assertEqual(self.client.get(f'/api/products/{pk}/').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/products/{pk}/', {'unit_price': '13.00'}, format='json').data['unit_price'], '13.00')
        for payload in [{'unit_price': '-1'}, {'unit_price': '1.001'}, {'stock_quantity': -1}, {'stock_quantity': 100}, {'product_id': 100}]:
            self.assertEqual(self.client.patch(f'/api/products/{pk}/', payload, format='json').status_code, 400)
        filtered = self.client.get('/api/products/?category=New&ordering=-unit_price')
        self.assertEqual(filtered.data['count'], 1)
        self.assertEqual(self.client.delete(f'/api/products/{pk}/').status_code, 204)
        self.assertEqual(self.client.delete(f'/api/products/{self.product.pk}/').status_code, 409)

    def test_order_creation_totals_and_historical_price_snapshot(self):
        order = self.create()
        self.assertEqual(order['status'], 'Pending')
        self.assertEqual(order['total'], '28.00')
        self.assertEqual(order['items'][0]['line_total'], '20.50')
        self.client.patch(f'/api/products/{self.product.pk}/', {'unit_price': '99.99'}, format='json')
        current = self.client.get(f"/api/orders/{order['order_id']}/")
        self.assertEqual(current.data['total'], '28.00')
        self.assertEqual(current.data['items'][0]['unit_price'], '10.25')
        self.assertEqual(self.client.get('/api/orders/?status=Pending&search=Test').data['count'], 1)
        self.assertEqual(self.client.get('/api/orders/?status=Delivered').data['count'], 0)

    def test_all_invalid_order_data_is_rejected_without_partial_records(self):
        invalid = [
            {'supplier_id': 999999}, {'items': []},
            {'items': [{'product_id': 999999, 'quantity': 1}]},
            {'items': [{'product_id': self.product.pk, 'quantity': 0}]},
            {'items': [{'product_id': self.product.pk, 'quantity': -2}]},
            {'items': [{'product_id': self.product.pk, 'quantity': '1.5'}]},
            {'items': [{'product_id': self.product.pk, 'quantity': 1, 'unit_price': '-1'}]},
            {'items': [{'product_id': self.product.pk, 'quantity': 1}, {'product_id': self.product.pk, 'quantity': 2}]},
            {'expected_delivery_date': '2026-11-05'}, {'order_date': '2026-02-30'},
            {'status': 'Delivered'}, {'order_id': 100},
        ]
        for values in invalid:
            with self.subTest(values=values):
                response = self.client.post('/api/orders/', self.draft(**values), format='json')
                self.assertEqual(response.status_code, 400, response.data)
                self.assertEqual(PurchaseOrder.objects.count(), 0)
                self.assertEqual(PurchaseOrderItem.objects.count(), 0)

    def test_pending_patch_preserves_captured_prices_and_revalidates_full_items(self):
        order = self.create()
        pk = order['order_id']
        self.product.unit_price = Decimal('88.00'); self.product.save(update_fields=['unit_price'])
        response = self.client.patch(f'/api/orders/{pk}/', {'items': [{'product_id': self.product.pk, 'quantity': 3}]}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['total'], '30.75')
        for values in [{'items': [{'product_id': self.product.pk}]}, {'items': []}, {'status': 'Approved'}, {'expected_delivery_date': '2026-11-05'}]:
            self.assertEqual(self.client.patch(f'/api/orders/{pk}/', values, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/orders/{pk}/approve/').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/orders/{pk}/', {'expected_delivery_date': None}, format='json').status_code, 409)
        self.assertEqual(self.client.delete(f'/api/orders/{pk}/').status_code, 405)

    def test_delivery_status_actions_and_duplicate_protection(self):
        order = self.create(); pk = order['order_id']
        self.assertEqual(self.client.post(f'/api/orders/{pk}/deliver/').status_code, 409)
        self.assertEqual(self.client.post(f'/api/orders/{pk}/approve/').status_code, 200)
        self.assertEqual(self.client.post(f'/api/orders/{pk}/approve/').status_code, 409)
        self.assertEqual(self.client.post(f'/api/orders/{pk}/deliver/').status_code, 200)
        self.product.refresh_from_db(); self.assertEqual(self.product.stock_quantity, 7)
        self.assertEqual(self.client.post(f'/api/orders/{pk}/deliver/').status_code, 409)
        self.assertEqual(self.client.post(f'/api/orders/{pk}/cancel/').status_code, 409)
        self.product.refresh_from_db(); self.assertEqual(self.product.stock_quantity, 7)
        self.assertEqual(self.client.delete(f'/api/products/{self.product.pk}/').status_code, 409)

    def test_cancelled_orders_never_update_inventory(self):
        order = self.create(); pk = order['order_id']
        self.assertEqual(self.client.post(f'/api/orders/{pk}/cancel/').status_code, 200)
        self.assertEqual(self.client.post(f'/api/orders/{pk}/deliver/').status_code, 409)
        self.assertEqual(self.client.post(f'/api/orders/{pk}/approve/').status_code, 409)
        self.product.refresh_from_db(); self.assertEqual(self.product.stock_quantity, 5)
        self.assertEqual(self.client.get('/api/dashboard/').data['total_purchasing_value'], '0.00')

    def test_catalog_edit_does_not_overwrite_concurrent_inventory_value(self):
        # A serializer may have read its instance before a delivery commits.
        from .api.serializers import ProductSerializer
        from .api.views import ProductViewSet
        serializer = ProductSerializer(self.product, data={'unit_price': '22.00'}, partial=True)
        self.assertTrue(serializer.is_valid())
        Product.objects.filter(pk=self.product.pk).update(stock_quantity=12)
        ProductViewSet().perform_update(serializer)
        self.product.refresh_from_db(); self.assertEqual(self.product.stock_quantity, 12)

    def test_creation_and_amendment_rollback_after_partial_item_insert(self):
        def failing_insert(queryset, objs, **kwargs):
            objs[0].save(force_insert=True)
            raise IntegrityError('Injected item failure')
        with patch.object(QuerySet, 'bulk_create', autospec=True, side_effect=failing_insert):
            with self.assertRaises(IntegrityError):
                services.create_order(supplier_id=self.supplier.pk, order_date=date(2026, 11, 6), items=[{'product_id': self.product.pk, 'quantity': 2}])
        self.assertEqual(PurchaseOrder.objects.count(), 0)
        self.assertEqual(PurchaseOrderItem.objects.count(), 0)
        order = self.create(); pk = order['order_id']
        with patch.object(QuerySet, 'bulk_create', autospec=True, side_effect=failing_insert):
            with self.assertRaises(IntegrityError):
                services.amend_order(pk, {'items': [{'product_id': self.product.pk, 'quantity': 4}]})
        self.assertEqual(PurchaseOrder.objects.get(pk=pk).total, Decimal('28.00'))

    def test_delivery_rolls_back_product_updates_if_status_save_fails(self):
        order = self.create(); pk = order['order_id']; services.transition_order(pk, 'Approved')
        original_save = PurchaseOrder.save
        def fail_status(instance, *args, **kwargs):
            if instance.status == 'Delivered':
                raise IntegrityError('Injected status failure')
            return original_save(instance, *args, **kwargs)
        with patch.object(PurchaseOrder, 'save', new=fail_status):
            with self.assertRaises(IntegrityError):
                services.transition_order(pk, 'Delivered')
        self.product.refresh_from_db(); self.other_product.refresh_from_db()
        self.assertEqual([self.product.stock_quantity, self.other_product.stock_quantity], [5, 2])
        self.assertEqual(PurchaseOrder.objects.get(pk=pk).status, 'Approved')

    def test_delivery_rolls_back_when_second_database_update_fails(self):
        order = self.create(); pk = order['order_id']; services.transition_order(pk, 'Approved')
        original_update = QuerySet.update; calls = 0
        def failing_update(queryset, **kwargs):
            nonlocal calls
            if queryset.model is Product:
                calls += 1
                if calls == 2:
                    raise OperationalError('Injected stock update failure')
            return original_update(queryset, **kwargs)
        with patch.object(QuerySet, 'update', new=failing_update):
            with self.assertRaises(OperationalError):
                services.transition_order(pk, 'Delivered')
        self.product.refresh_from_db(); self.other_product.refresh_from_db()
        self.assertEqual([self.product.stock_quantity, self.other_product.stock_quantity], [5, 2])
        self.assertEqual(PurchaseOrder.objects.get(pk=pk).status, 'Approved')

    def test_reports_use_decimal_derived_values_and_all_statuses(self):
        first = self.create(); second = self.create()
        services.transition_order(first['order_id'], 'Approved'); services.transition_order(first['order_id'], 'Delivered')
        services.transition_order(second['order_id'], 'Cancelled')
        report = self.client.get('/api/dashboard/')
        self.assertEqual(report.status_code, 200, report.data)
        self.assertEqual(report.data['total_purchasing_value'], '28.00')
        self.assertEqual(report.data['delivered_order_value'], '28.00')
        self.assertEqual(report.data['stock_overview']['total_units'], 12)
        spending = self.client.get('/api/analytics/supplier-spending/').data['results']
        self.assertEqual(spending[0]['total'], '28.00'); self.assertEqual(spending[0]['order_count'], 1)
        statuses = self.client.get('/api/analytics/order-status/').data['results']
        self.assertEqual({r['status']: r['count'] for r in statuses}, {'Pending': 0, 'Approved': 0, 'Delivered': 1, 'Cancelled': 1})
        self.assertEqual(self.client.get('/api/dashboard/?low_stock_threshold=-1').status_code, 400)

    @override_settings(ERP_READ_TOKEN='r' * 40, ERP_WRITE_TOKEN='w' * 40)
    def test_real_bearer_authentication_and_compatibility_alias(self):
        client = APIClient(); client.credentials(HTTP_AUTHORIZATION='Bearer ' + 'r' * 40)
        self.assertEqual(client.get('/api/suppliers/').status_code, 200)
        self.assertEqual(client.get('/api/v1/suppliers/').status_code, 200)
        self.assertEqual(client.post('/api/suppliers/', {}, format='json').status_code, 403)
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + 'w' * 40)
        self.assertEqual(client.post('/api/products/', {'product_name': 'Authorized', 'unit_price': '0.00'}, format='json').status_code, 201)

    def test_pagination(self):
        for i in range(27):
            Supplier.objects.create(supplier_name=f'Pagination {i}', email=f'page{i}@example.test')
        first = self.client.get('/api/suppliers/'); second = self.client.get('/api/suppliers/?page=2')
        self.assertEqual(first.data['count'], 28); self.assertEqual(len(first.data['results']), 25)
        self.assertEqual(len(second.data['results']), 3)

    def test_database_constraints_and_identity_columns_are_preserved(self):
        self.assertTrue(all(not model._meta.managed for model in [Supplier, Product, PurchaseOrder, PurchaseOrderItem]))
        with connection.cursor() as cursor:
            cursor.execute("SELECT table_name, identity_generation FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('suppliers','products','purchase_orders','purchase_order_items') AND is_identity='YES' ORDER BY table_name")
            identities = cursor.fetchall()
        self.assertEqual(len(identities), 4)
        self.assertTrue(all(generation == 'ALWAYS' for _, generation in identities))
        with self.assertRaises(IntegrityError), transaction.atomic():
            Product.objects.create(product_name='Negative', unit_price=Decimal('-1'), stock_quantity=0)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Product.objects.filter(pk=self.product.pk).update(stock_quantity=-1)
        order = self.create(); obj = PurchaseOrder.objects.get(pk=order['order_id'])
        with self.assertRaises(IntegrityError), transaction.atomic():
            PurchaseOrderItem.objects.create(order=obj, product=self.product, quantity=1, unit_price=1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            PurchaseOrder.objects.filter(pk=obj.pk).update(status='Unknown')
        with self.assertRaises(IntegrityError), transaction.atomic():
            PurchaseOrder.objects.filter(pk=obj.pk).update(expected_delivery_date=date(2026, 11, 5))


    def test_stock_overflow_rejects_delivery_without_partial_updates(self):
        order = self.create(); pk = order['order_id']; services.transition_order(pk, 'Approved')
        Product.objects.filter(pk=self.other_product.pk).update(stock_quantity=2147483647)
        self.assertEqual(self.client.post(f'/api/orders/{pk}/deliver/').status_code, 409)
        self.product.refresh_from_db(); self.assertEqual(self.product.stock_quantity, 5)
        self.assertEqual(PurchaseOrder.objects.get(pk=pk).status, 'Approved')

    def test_database_item_and_relationship_constraints(self):
        from django.db import DatabaseError
        order = self.create(); pk = order['order_id']
        for change in [{'quantity': 0}, {'quantity': -1}, {'unit_price': Decimal('-0.01')}]:
            with self.assertRaises(IntegrityError), transaction.atomic():
                PurchaseOrderItem.objects.filter(order_id=pk).update(**change)
        with self.assertRaises(IntegrityError), transaction.atomic():
            PurchaseOrder.objects.filter(pk=pk).update(supplier_id=999999)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Supplier.objects.create(supplier_name='Duplicate', email=self.supplier.email)
        with self.assertRaises(DatabaseError), transaction.atomic():
            Supplier.objects.create(supplier_id=999999, supplier_name='Explicit ID', email='explicit@example.test')

    def test_inspectdb_confirms_the_manual_legacy_mappings(self):
        from io import StringIO
        from django.core.management import call_command
        output = StringIO()
        call_command('inspectdb', 'suppliers', 'products', 'purchase_orders', 'purchase_order_items', stdout=output)
        generated = output.getvalue()
        self.assertEqual(generated.count('        managed = False'), 4)
        for column in ['supplier_id', 'product_id', 'order_id', 'item_id']:
            self.assertIn(column, generated)
        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(cursor, 'purchase_order_items')
        for name in ['uq_order_product', 'purchase_order_items_quantity_check', 'purchase_order_items_unit_price_check', 'fk_item_order', 'fk_item_product']:
            self.assertIn(name, constraints)


    @override_settings(ERP_READ_TOKEN='r' * 40, ERP_WRITE_TOKEN='w' * 40)
    def test_complete_authenticated_supplier_to_delivery_flow(self):
        client = APIClient(); client.credentials(HTTP_AUTHORIZATION='Bearer ' + 'w' * 40)
        scope = client.get('/api/access/')
        self.assertEqual(scope.status_code, 200); self.assertTrue(scope.data['can_write'])
        supplier = client.post('/api/suppliers/', {'supplier_name': 'Workflow test supplier', 'email': 'workflow@example.test'}, format='json')
        self.assertEqual(supplier.status_code, 201, supplier.data)
        product = client.post('/api/products/', {'product_name': 'Workflow test product', 'category': 'Integration test', 'unit_price': '11.25'}, format='json')
        self.assertEqual(product.status_code, 201, product.data); self.assertEqual(product.data['stock_quantity'], 0)
        order = client.post('/api/orders/', {'supplier_id': supplier.data['supplier_id'], 'order_date': '2026-11-06', 'items': [{'product_id': product.data['product_id'], 'quantity': 4}]}, format='json')
        self.assertEqual(order.status_code, 201, order.data); pk = order.data['order_id']
        self.assertEqual(order.data['total'], '45.00'); self.assertEqual(order.data['status'], 'Pending')
        self.assertEqual(client.post(f'/api/orders/{pk}/approve/', {}, format='json').status_code, 200)
        self.assertEqual(client.post(f'/api/orders/{pk}/deliver/', {}, format='json').status_code, 200)
        stock = client.get(f"/api/products/{product.data['product_id']}/")
        self.assertEqual(stock.data['stock_quantity'], 4)
        self.assertEqual(client.post(f'/api/orders/{pk}/deliver/', {}, format='json').status_code, 409)
        self.assertEqual(client.get(f"/api/products/{product.data['product_id']}/").data['stock_quantity'], 4)
        self.assertEqual(client.get('/api/dashboard/').data['total_purchasing_value'], '45.00')
        spending = client.get('/api/analytics/supplier-spending/').data['results']
        self.assertEqual(next(row for row in spending if row['supplier_id'] == supplier.data['supplier_id'])['total'], '45.00')
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + 'r' * 40)
        self.assertFalse(client.get('/api/access/').data['can_write'])
        self.assertEqual(client.post('/api/products/', {}, format='json').status_code, 403)


class ConcurrentDeliveryTests(FixtureMixin, TransactionTestCase):
    def clear_business_tables(self):
        assert_isolated(connection)
        if connection.settings_dict['NAME'] != 'test_jedel_api':
            raise AssertionError('Refusing to clear a non-test database.')
        with connection.cursor() as cursor:
            cursor.execute('TRUNCATE purchase_order_items, purchase_orders, products, suppliers RESTART IDENTITY')

    def setUp(self):
        self.clear_business_tables(); self.seed()

    def tearDown(self):
        self.clear_business_tables()

    def race(self, operations):
        barrier = Barrier(len(operations), timeout=15)
        def worker(operation):
            connections.close_all()
            client = APIClient(); client.force_authenticate(user=ApiPrincipal(can_write=True))
            try:
                barrier.wait()
                return client.post(operation).status_code
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=len(operations)) as pool:
            return list(pool.map(worker, operations))

    def test_two_delivery_attempts_increment_inventory_once(self):
        order = self.create(); pk = order['order_id']; services.transition_order(pk, 'Approved')
        statuses = self.race([f'/api/orders/{pk}/deliver/'] * 2)
        self.assertEqual(sorted(statuses), [200, 409])
        self.product.refresh_from_db(); self.other_product.refresh_from_db()
        self.assertEqual([self.product.stock_quantity, self.other_product.stock_quantity], [7, 5])

    def test_two_orders_for_same_products_do_not_lose_updates(self):
        first = self.create(); second = self.create()
        services.transition_order(first['order_id'], 'Approved'); services.transition_order(second['order_id'], 'Approved')
        statuses = self.race([f"/api/orders/{first['order_id']}/deliver/", f"/api/orders/{second['order_id']}/deliver/"])
        self.assertEqual(statuses, [200, 200])
        self.product.refresh_from_db(); self.other_product.refresh_from_db()
        self.assertEqual([self.product.stock_quantity, self.other_product.stock_quantity], [9, 8])

    def test_cancel_racing_delivery_has_one_winner(self):
        order = self.create(); pk = order['order_id']; services.transition_order(pk, 'Approved')
        statuses = self.race([f'/api/orders/{pk}/deliver/', f'/api/orders/{pk}/cancel/'])
        self.assertEqual(sorted(statuses), [200, 409])
        current = PurchaseOrder.objects.get(pk=pk); self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 7 if current.status == 'Delivered' else 5)
