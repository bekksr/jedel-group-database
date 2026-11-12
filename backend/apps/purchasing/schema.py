"""Small dependency-free OpenAPI reference for existing JSON endpoints."""
from django.http import JsonResponse, HttpResponse
from html import escape

OPERATIONS = {
    '/api/catalog/products/': {'get': 'Public product identifiers, names and categories only; search/category filters and pagination'},
    '/api/catalog/products/{id}/': {'get': 'Public product detail; no prices or stock'},
    '/api/catalog/categories/': {'get': 'Public product category names only'},
    '/api/auth/csrf/': {'get': 'Obtain a CSRF cookie before login or registration'},
    '/api/auth/register/': {'post': 'Create an active Basic User and authenticated session'},
    '/api/auth/login/': {'post': 'Log in with email or legacy username (identifier) and password; CSRF required'},
    '/api/auth/logout/': {'post': 'Invalidate current session; CSRF required'},
    '/api/auth/me/': {'get': 'Retrieve current account and capabilities'},
    '/api/auth/profile/': {'patch': 'Update name only; CSRF required'},
    '/api/auth/password/': {'post': 'Change password with current_password and new_password'},
    '/api/security/accounts/': {'get': 'List accounts eligible for delegated activation'},
    '/api/security/accounts/{id}/': {'patch': 'Change only is_active for eligible employees or analysts'},
    '/api/access/': {'get': 'Retrieve effective account capabilities'},
    '/api/suppliers/': {'get': 'List suppliers; page, search and ordering filters', 'post': 'Create supplier'},
    '/api/suppliers/{id}/': {'get': 'Retrieve supplier', 'patch': 'Edit supplier', 'delete': 'Delete eligible supplier'},
    '/api/products/': {'get': 'List products; page, search, category and ordering filters', 'post': 'Create product with zero stock'},
    '/api/products/{id}/': {'get': 'Retrieve product', 'patch': 'Edit catalog fields, never stock', 'delete': 'Delete eligible zero-stock product'},
    '/api/orders/': {'get': 'List orders; page, search, status and ordering filters', 'post': 'Create Pending order and capture prices'},
    '/api/orders/{id}/': {'get': 'Retrieve order and captured items', 'patch': 'Amend Pending order preserving existing captured prices'},
    '/api/orders/{id}/approve/': {'post': 'Approve Pending order with empty JSON body'},
    '/api/orders/{id}/deliver/': {'post': 'Deliver Approved order atomically once with empty JSON body'},
    '/api/orders/{id}/cancel/': {'post': 'Cancel eligible order with empty JSON body'},
    '/api/dashboard/': {'get': 'Retrieve PostgreSQL purchasing and inventory metrics'},
    '/api/analytics/supplier-spending/': {'get': 'Spending from captured prices excluding Cancelled orders'},
    '/api/analytics/order-status/': {'get': 'Count orders by status'},
    '/health/': {'get': 'Database and required-table readiness'},
    '/api/health/': {'get': 'Application liveness; database not checked'},
}

def schema(request):
    paths = {}
    for path, methods in OPERATIONS.items():
        paths[path] = {}
        for method, summary in methods.items():
            operation = {'summary': summary, 'responses': {'200': {'description': 'Success (POST creation returns 201; deletion returns 204)'}, '400': {'description': 'Validation error'}, '401': {'description': 'Session required'}, '403': {'description': 'Permission or CSRF denied'}, '409': {'description': 'Workflow conflict'}, '503': {'description': 'Database unavailable'}}}
            if '{id}' in path:
                operation['parameters'] = [{'name': 'id', 'in': 'path', 'required': True, 'schema': {'type': 'integer'}}]
            if method in ('post', 'patch'):
                operation['requestBody'] = {'description': 'JSON fields documented in docs/API.md; unsafe requests require X-CSRFToken.', 'content': {'application/json': {'schema': {'type': 'object'}}}}
            if method == 'delete':
                operation['responses']['204'] = {'description': 'Deleted'}
            if method == 'post' and path in ('/api/auth/register/', '/api/suppliers/', '/api/products/', '/api/orders/'):
                operation['responses']['201'] = {'description': 'Created'}
            if path in ('/api/auth/csrf/', '/api/auth/login/', '/api/auth/register/', '/health/', '/api/health/', '/api/catalog/products/', '/api/catalog/products/{id}/', '/api/catalog/categories/'):
                operation['security'] = []
            paths[path][method] = operation
    return JsonResponse({'openapi': '3.1.0', 'info': {'title': 'Jedel.Group ERP', 'version': '1.0', 'description': 'Session-authenticated JSON API. See docs/API.md for payloads and permission matrix.'}, 'paths': paths, 'security': [{'session': []}], 'components': {'securitySchemes': {'session': {'type': 'apiKey', 'in': 'cookie', 'name': 'sessionid'}}}})

def docs(request):
    rows = ''.join('<tr><td>' + escape(method.upper()) + '</td><td>' + escape(path) + '</td><td>' + escape(summary) + '</td></tr>' for path, methods in OPERATIONS.items() for method, summary in methods.items())
    return HttpResponse('<h1>Jedel.Group API</h1><p>Sign in through Angular. Unsafe requests require a session and CSRF token; anonymous login and registration also require CSRF.</p><a href="/api/schema/">OpenAPI JSON</a><table><tr><th>Method</th><th>Path</th><th>Description</th></tr>' + rows + '</table>')
