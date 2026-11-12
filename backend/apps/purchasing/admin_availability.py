"""Keep anonymous admin failures useful without leaking database exceptions."""
from django.db import connection, DatabaseError
from django.http import HttpResponse

class AdminAvailabilityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    def __call__(self, request):
        if request.path.startswith('/admin/'):
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT to_regclass('auth_user'), to_regclass('auth_group'), to_regclass('django_session'), to_regclass('django_admin_log')")
                    available = all(cursor.fetchone())
            except DatabaseError:
                available = False
            if not available:
                return HttpResponse('<!doctype html><html lang="en"><title>Administration unavailable</title><h1>Administration is not ready</h1><p>The account service requires administrator setup or database recovery. Existing-database migrations require approval. No migration was applied by this request.</p><a href="/">Backend home</a></html>', status=503)
        return self.get_response(request)
