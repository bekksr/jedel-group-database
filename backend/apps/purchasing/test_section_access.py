from django.contrib.auth.models import User,Group
from django.test import TestCase
from rest_framework.test import APIClient
from .tests import FixtureMixin
from .api.serializers import OrderWriteSerializer

class FiveSectionPermissionTests(FixtureMixin,TestCase):
    def setUp(self):
        self.seed()
        serializer=OrderWriteSerializer(data=self.draft());serializer.is_valid(raise_exception=True);self.order=serializer.save()

    def test_all_sections_private_list_detail_and_report_boundaries_for_every_role(self):
        private=[
            '/api/suppliers/',f'/api/suppliers/{self.supplier.pk}/',
            '/api/products/',f'/api/products/{self.product.pk}/',
            '/api/orders/',f'/api/orders/{self.order.pk}/',
            '/api/dashboard/','/api/analytics/supplier-spending/','/api/analytics/order-status/',
        ]
        roles=['Anonymous','Basic User','Purchasing Employee','Purchasing Manager','Analyst / Tester','System Administrator','Security Administrator']
        for index,role in enumerate(roles):
            client=APIClient()
            if role!='Anonymous':
                user=User.objects.create_user('five-section-'+str(index));user.groups.add(Group.objects.get_or_create(name=role)[0]);client.force_login(user)
            expected=401 if role=='Anonymous' else 403 if role in ['Basic User','Security Administrator'] else 200
            for path in private:
                with self.subTest(role=role,path=path):
                    response=client.get(path)
                    self.assertEqual(response.status_code,expected)
                    if expected!=200:
                        self.assertNotIn(self.supplier.email,str(response.data));self.assertNotIn('unit_price',str(response.data));self.assertNotIn('stock_quantity',str(response.data))
            for path in ['/api/catalog/products/',f'/api/catalog/products/{self.product.pk}/','/api/catalog/categories/']:
                response=client.get(path);self.assertEqual(response.status_code,200)
                self.assertNotIn('unit_price',str(response.data));self.assertNotIn('stock_quantity',str(response.data));self.assertNotIn(self.supplier.email,str(response.data))

    def test_unauthorized_filters_cannot_disclose_contact_order_or_financial_fields(self):
        client=APIClient();user=User.objects.create_user('basic-filter');user.groups.add(Group.objects.get_or_create(name='Basic User')[0]);client.force_login(user)
        for path in ['/api/suppliers/?search=supplier@example.test','/api/orders/?ordering=order_id','/api/dashboard/?low_stock_threshold=999999','/api/analytics/supplier-spending/?supplier_id=1']:
            self.assertEqual(client.get(path).status_code,403)
        for path in ['/api/catalog/products/?fields=email','/api/catalog/products/?ordering=unit_price','/api/catalog/products/?stock_quantity__gte=1']:
            self.assertEqual(client.get(path).status_code,400)
