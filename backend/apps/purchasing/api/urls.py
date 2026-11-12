from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import HealthView, SupplierViewSet, ProductViewSet, OrderViewSet, DashboardView, SupplierSpendingView, OrderStatusView, AccessView

from .catalog import PublicProductViewSet, PublicCategoryView
from ..copilot import views as copilot

app_name = 'purchasing'
router = DefaultRouter()
router.register('catalog/products', PublicProductViewSet, basename='public-product')
router.register('suppliers', SupplierViewSet, basename='supplier')
router.register('products', ProductViewSet, basename='product')
router.register('orders', OrderViewSet, basename='order')
urlpatterns = [
    path('ai/capabilities/', copilot.CapabilitiesView.as_view(), name='ai-capabilities'),
    path('ai/products/search/', copilot.SearchView.as_view(), name='ai-search'),
    path('ai/inventory/', copilot.InventoryView.as_view(), name='ai-inventory'),
    path('ai/offers/compare/', copilot.OffersView.as_view(), name='ai-offers'),
    path('ai/orders/draft/', copilot.DraftView.as_view(), name='ai-draft'),
    path('ai/orders/status/', copilot.OrderStatusView.as_view(), name='ai-order-status'),
    path('ai/suppliers/', copilot.SuppliersView.as_view(), name='ai-suppliers'),
    path('ai/chat/', copilot.ChatView.as_view(), name='ai-chat'),
    path('catalog/categories/', PublicCategoryView.as_view(), name='public-categories'),
    path('access/', AccessView.as_view(), name='access'),
    path('health/', HealthView.as_view(), name='health'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('analytics/supplier-spending/', SupplierSpendingView.as_view(), name='supplier-spending'),
    path('analytics/order-status/', OrderStatusView.as_view(), name='order-status'),
    *router.urls,
]
