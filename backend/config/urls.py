from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.db import connection, DatabaseError
from django.urls import include, path
from apps.purchasing import auth_views, security_views, schema

def landing(request):
    return render(request, 'purchasing/backend_home.html')

def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT to_regclass('suppliers'), to_regclass('products'), to_regclass('purchase_orders'), to_regclass('purchase_order_items'), to_regclass('auth_user'), to_regclass('django_session')")
            ready = all(cursor.fetchone())
        return JsonResponse({'status': 'ok' if ready else 'unavailable'}, status=200 if ready else 503)
    except DatabaseError:
        return JsonResponse({'status': 'unavailable'}, status=503)

urlpatterns = [
    path('', landing), path('health/', health), path('admin/', admin.site.urls),
    path('api/docs/', schema.docs), path('api/schema/', schema.schema),
    path('api/security/accounts/', security_views.accounts), path('api/security/accounts/<int:pk>/', security_views.activation),
    path('api/auth/csrf/', auth_views.csrf), path('api/auth/register/', auth_views.register),
    path('api/auth/login/', auth_views.sign_in), path('api/auth/logout/', auth_views.sign_out),
    path('api/auth/me/', auth_views.me), path('api/auth/profile/', auth_views.edit_profile),
    path('api/auth/password/', auth_views.password),
    path('api/', include('apps.purchasing.api.urls')),
    path('api/v1/', include('apps.purchasing.api.urls', namespace='purchasing-v1')),
]
