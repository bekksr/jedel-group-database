from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import HealthView, SupplierViewSet, ProductViewSet, OrderViewSet, DashboardView, SupplierSpendingView, OrderStatusView, AccessView

app_name = 'purchasing'
router = DefaultRouter()
router.register('suppliers', SupplierViewSet, basename='supplier')
router.register('products', ProductViewSet, basename='product')
router.register('orders', OrderViewSet, basename='order')
urlpatterns = [
    path('access/', AccessView.as_view(), name='access'),
    path('health/', HealthView.as_view(), name='health'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('analytics/supplier-spending/', SupplierSpendingView.as_view(), name='supplier-spending'),
    path('analytics/order-status/', OrderStatusView.as_view(), name='order-status'),
    *router.urls,
]
