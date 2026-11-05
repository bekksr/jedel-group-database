"""Authorization and security regressions; DB cases use the guarded test cluster."""
from io import BytesIO
import os
from pathlib import Path
import secrets
import subprocess
import sys
from unittest.mock import patch
from django.core.exceptions import ImproperlyConfigured
from django.db import connection
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient
from .tests import FixtureMixin
from .models import Product, PurchaseOrder, Supplier
from .api.parsers import LimitedJSONParser, PayloadTooLarge
from config.test_runner import assert_isolated


TOKENS = {'ERP_READ_TOKEN': 'v' * 40, 'ERP_WRITE_TOKEN': 'a' * 40, 'ERP_BUYER_TOKEN': 'b' * 40, 'ERP_APPROVER_TOKEN': 'p' * 40}


@override_settings(**TOKENS)
class CredentialRoleTests(FixtureMixin, TestCase):
    def setUp(self):
        self.seed()
        self.order_id = self.create()['order_id']

    def client_for(self, token):
        client = APIClient(enforce_csrf_checks=True)
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + token * 40)
        return client

    def test_viewer_can_read_but_cannot_write(self):
        client = self.client_for('v')
        access = client.get('/api/access/')
        self.assertEqual(access.data['role'], 'viewer')
        self.assertFalse(any(access.data['capabilities'].values()))
        self.assertEqual(client.get('/api/dashboard/').status_code, 200)
        self.assertEqual(client.post('/api/products/', {}, format='json').status_code, 403)
        self.assertEqual(client.post(f'/api/orders/{self.order_id}/approve/', {}, format='json').status_code, 403)

    def test_buyer_can_manage_catalog_and_orders_but_cannot_approve_or_delete(self):
        client = self.client_for('b')
        self.assertEqual(client.get('/api/access/').data['role'], 'buyer')
        created = client.post('/api/products/', {'product_name': 'Role test product', 'unit_price': '2.25'}, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(client.patch(f"/api/products/{created.data['product_id']}/", {'unit_price': '3.00'}, format='json').status_code, 200)
        self.assertEqual(client.post('/api/orders/', self.draft(), format='json').status_code, 201)
        self.assertEqual(client.patch(f'/api/orders/{self.order_id}/', {'expected_delivery_date': None}, format='json').status_code, 200)
        for action in ['approve', 'deliver', 'cancel']:
            self.assertEqual(client.post(f'/api/orders/{self.order_id}/{action}/', {'role': 'admin'}, format='json').status_code, 403)
        self.assertEqual(client.delete(f"/api/products/{created.data['product_id']}/").status_code, 403)
        self.assertTrue(Product.objects.filter(pk=created.data['product_id']).exists())
        self.assertEqual(PurchaseOrder.objects.get(pk=self.order_id).status, 'Pending')

    def test_approver_can_approve_deliver_and_cancel_but_cannot_edit_catalog(self):
        client = self.client_for('p')
        self.assertEqual(client.get('/api/access/').data['role'], 'approver')
        self.assertEqual(client.post('/api/suppliers/', {}, format='json').status_code, 403)
        self.assertEqual(client.post('/api/products/', {}, format='json').status_code, 403)
        self.assertEqual(client.post('/api/orders/', self.draft(), format='json').status_code, 403)
        self.assertEqual(client.patch(f'/api/orders/{self.order_id}/', {}, format='json').status_code, 403)
        self.assertEqual(client.post(f'/api/orders/{self.order_id}/approve/', {}, format='json').status_code, 200)
        self.assertEqual(client.post(f'/api/orders/{self.order_id}/deliver/', {}, format='json').status_code, 200)
        self.assertEqual(client.post(f'/api/orders/{self.order_id}/deliver/', {}, format='json').status_code, 409)
        self.product.refresh_from_db(); self.assertEqual(self.product.stock_quantity, 7)
        other = self.create()['order_id']
        self.assertEqual(client.post(f'/api/orders/{other}/cancel/', {}, format='json').status_code, 200)

    def test_admin_can_delete_unreferenced_zero_stock_records(self):
        client = self.client_for('a')
        self.assertEqual(client.get('/api/access/').data['role'], 'admin')
        product = client.post('/api/products/', {'product_name': 'Disposable test', 'unit_price': '0.00'}, format='json')
        self.assertEqual(client.delete(f"/api/products/{product.data['product_id']}/").status_code, 204)
        supplier = client.post('/api/suppliers/', {'supplier_name': 'Disposable test', 'email': 'discard@example.test'}, format='json')
        self.assertEqual(client.delete(f"/api/suppliers/{supplier.data['supplier_id']}/").status_code, 204)

    @override_settings(DATA_UPLOAD_MAX_MEMORY_SIZE=64)
    def test_oversized_json_returns_413_without_writes(self):
        client = self.client_for('b')
        before = Supplier.objects.count()
        response = client.post('/api/suppliers/', {'supplier_name': 'x' * 100, 'email': 'size@example.test'}, format='json')
        self.assertEqual(response.status_code, 413)
        self.assertEqual(Supplier.objects.count(), before)

    def test_status_filter_and_nonfinite_prices_are_validated(self):
        client = self.client_for('a')
        self.assertEqual(client.get('/api/orders/?status=Unknown').status_code, 400)
        self.assertEqual(client.post('/api/dashboard/', {}, format='json').status_code, 405)
        for value in ['NaN', 'Infinity', '-Infinity']:
            self.assertEqual(client.post('/api/products/', {'product_name': 'Invalid price', 'unit_price': value}, format='json').status_code, 400)
        self.assertEqual(client.post('/api/products/', {'product_name': 'Not JSON'}, format='multipart').status_code, 415)

    def test_bearer_requests_do_not_require_cookie_csrf_but_have_private_cache_policy(self):
        client = self.client_for('b')
        response = client.post('/api/products/', {'product_name': 'CSRF boundary test', 'unit_price': '1.00'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.headers['Cache-Control'], 'no-store, private')
        self.assertIn('authorization', response.headers['Vary'].lower())
        anonymous = APIClient(enforce_csrf_checks=True)
        self.assertEqual(anonymous.post('/api/products/', {}, format='json').status_code, 401)


class SecurityBoundaryTests(SimpleTestCase):
    @override_settings(DATA_UPLOAD_MAX_MEMORY_SIZE=32)
    def test_parser_bounds_actual_stream_without_content_length(self):
        with self.assertRaises(PayloadTooLarge):
            LimitedJSONParser().parse(BytesIO(b'x' * 33))

    def test_cors_preflight_allows_authorization_only_for_configured_origin(self):
        client = APIClient()
        headers = {'HTTP_ACCESS_CONTROL_REQUEST_METHOD': 'POST', 'HTTP_ACCESS_CONTROL_REQUEST_HEADERS': 'authorization,content-type'}
        response = client.options('/api/products/', HTTP_ORIGIN='http://localhost:4200', **headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:4200')
        self.assertIn('authorization', response.headers['access-control-allow-headers'])
        self.assertNotIn('access-control-allow-credentials', response.headers)
        forbidden = client.options('/api/products/', HTTP_ORIGIN='https://untrusted.example', **headers)
        self.assertNotIn('access-control-allow-origin', forbidden.headers)

    def test_missing_isolation_marker_cannot_start_destructive_database_tests(self):
        with patch.dict(os.environ, {'JEDEL_ISOLATED_TESTS': '0'}):
            with self.assertRaises(ImproperlyConfigured):
                assert_isolated(connection)

    def test_default_configuration_fails_closed_without_production_secret(self):
        env = os.environ.copy()
        env.pop('DJANGO_DEBUG', None); env.pop('DJANGO_SECRET_KEY', None)
        result = subprocess.run([sys.executable, '-c', 'import config.settings'], cwd=Path(__file__).resolve().parents[2], env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Set DJANGO_SECRET_KEY', result.stderr)

    def test_debug_must_be_explicit_and_production_headers_are_enabled(self):
        env = os.environ.copy()
        env.pop('DJANGO_DEBUG', None)
        env['DJANGO_SECRET_KEY'] = secrets.token_urlsafe(64)
        script = 'import config.settings as s; assert not s.DEBUG; assert s.SECURE_SSL_REDIRECT; assert s.CSRF_COOKIE_SECURE; assert s.X_FRAME_OPTIONS == "DENY"'
        result = subprocess.run([sys.executable, '-c', script], cwd=Path(__file__).resolve().parents[2], env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
