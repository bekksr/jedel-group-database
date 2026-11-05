from django.utils.cache import patch_vary_headers


class ApiCachePolicyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/api/'):
            response['Cache-Control'] = 'no-store, private'
            response['Pragma'] = 'no-cache'
            patch_vary_headers(response, ['Authorization'])
        return response
