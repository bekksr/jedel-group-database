from decimal import Decimal
from django.contrib.auth.models import User, Group
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from .models import Product
from .tests import FixtureMixin

PUBLIC_FIELDS = {'product_id', 'product_name', 'category'}

class PublicCatalogTests(FixtureMixin, TestCase):
    def setUp(self):
        self.seed()
        self.product.category = 'Hardware'; self.product.save(update_fields=['category'])
        self.other_product.category = 'Office'; self.other_product.save(update_fields=['category'])
        self.public = APIClient()

    def assert_safe(self, record):
        self.assertEqual(set(record), PUBLIC_FIELDS)
        self.assertNotIn('unit_price', record); self.assertNotIn('stock_quantity', record)

    def test_anonymous_list_detail_and_categories_are_safe_and_do_not_select_private_columns(self):
        with CaptureQueriesContext(connection) as queries:
            response = self.public.get('/api/catalog/products/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        for row in response.data['results']: self.assert_safe(row)
        sql = ' '.join(query['sql'] for query in queries.captured_queries)
        self.assertNotIn('unit_price', sql); self.assertNotIn('stock_quantity', sql)
        response = self.public.get(f'/api/catalog/products/{self.product.pk}/')
        self.assertEqual(response.status_code, 200); self.assert_safe(response.data)
        self.assertEqual(self.public.get('/api/catalog/categories/').data['results'], ['Hardware', 'Office'])
        self.assertEqual(self.public.get('/api/catalog/products/999999/').status_code, 404)

    def test_basic_user_can_search_filter_and_page_without_private_business_access(self):
        user = User.objects.create_user('basic-catalog')
        user.groups.add(Group.objects.get_or_create(name='Basic User')[0]); self.public.force_login(user)
        response = self.public.get('/api/catalog/products/', {'search': 'Other', 'category': 'Office'})
        self.assertEqual(response.status_code, 200); self.assertEqual(response.data['count'], 1)
        self.assert_safe(response.data['results'][0]); self.assertEqual(response.data['results'][0]['product_id'], self.other_product.pk)
        self.assertEqual(self.public.get('/api/catalog/products/', {'category': 'missing'}).data['count'], 0)
        self.assertEqual(self.public.get('/api/products/').status_code, 403)
        for path in ['/api/suppliers/', '/api/orders/', '/api/analytics/supplier-spending/', '/api/dashboard/']:
            self.assertEqual(self.public.get(path).status_code, 403)
        for method,path in [('post','/api/products/'),('patch',f'/api/products/{self.product.pk}/'),('delete',f'/api/products/{self.product.pk}/'),('post','/api/orders/'),('post','/api/orders/999/approve/'),('post','/api/orders/999/deliver/')]:
            self.assertEqual(getattr(self.public,method)(path,{},format='json').status_code, 403)
        self.assertEqual(self.public.get('/admin/').status_code, 302)

    def test_filters_and_metadata_cannot_infer_private_values_or_enable_writes(self):
        for query in [{'ordering': 'unit_price'}, {'ordering': '-stock_quantity'}, {'unit_price__lt': '100'}, {'fields': 'unit_price'}, {'stock_quantity': '5'}]:
            self.assertEqual(self.public.get('/api/catalog/products/',query).status_code,400)
        self.product.unit_price = Decimal('99123.45'); self.product.save(update_fields=['unit_price'])
        self.assertEqual(self.public.get('/api/catalog/products/',{'search': '99123.45'}).data['count'],0)
        before = Product.objects.count()
        for method in ['post','patch','put','delete']:
            self.assertEqual(getattr(self.public,method)(f'/api/catalog/products/{self.product.pk}/',{},format='json').status_code,405)
        self.assertEqual(self.public.post('/api/catalog/products/',{},format='json').status_code,405)
        self.assertEqual(self.public.post('/api/catalog/categories/',{},format='json').status_code,405)
        self.assertEqual(Product.objects.count(),before)
        metadata = self.public.options('/api/catalog/products/').data
        self.assertNotIn('unit_price',str(metadata)); self.assertNotIn('stock_quantity',str(metadata))

    def test_pagination_and_public_sorting_preserve_allowlist(self):
        for index in range(26): Product.objects.create(product_name=f'Catalog {index}', category='Hardware', unit_price='17.25', stock_quantity=0)
        response = self.public.get('/api/catalog/products/',{'category': 'Hardware','ordering': 'product_name'})
        self.assertEqual(len(response.data['results']),25); self.assertIsNotNone(response.data['next'])
        for row in response.data['results']: self.assert_safe(row)
        self.assertEqual(len(self.public.get('/api/catalog/products/',{'category':'Hardware','page':2}).data['results']),2)

    def test_existing_named_roles_retain_private_capabilities(self):
        for index, role in enumerate(['Purchasing Employee','Purchasing Manager','System Administrator','Analyst / Tester','Security Administrator']):
            user = User.objects.create_user('catalog-role-' + str(index))
            user.groups.add(Group.objects.get_or_create(name=role)[0]); self.public.force_login(user)
            self.assertEqual(self.public.get('/api/catalog/products/').status_code,200)
            self.assertEqual(self.public.get('/api/products/').status_code,403 if role == 'Security Administrator' else 200)
            if role == 'Security Administrator':
                self.assertEqual(self.public.get('/api/security/accounts/').status_code,200)
