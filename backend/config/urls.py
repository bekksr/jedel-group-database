from django.urls import include, path

urlpatterns = [
    path('api/', include('apps.purchasing.api.urls')),
    path('api/v1/', include('apps.purchasing.api.urls', namespace='purchasing-v1')),
]
