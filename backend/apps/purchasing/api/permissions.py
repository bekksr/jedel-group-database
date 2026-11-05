from rest_framework.permissions import BasePermission, SAFE_METHODS


class ReadOrWriteAccess(BasePermission):
    message = 'This credential role does not permit that operation.'

    def has_permission(self, request, view):
        principal = request.user
        if not principal or not principal.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        # Let the view report 405 for unsupported methods after authentication.
        if request.method.lower() not in view.http_method_names or not hasattr(view, request.method.lower()):
            return True
        capabilities = getattr(principal, 'capabilities', {})
        action = getattr(view, 'action', '')
        if action in {'approve', 'deliver', 'cancel'}:
            return bool(capabilities.get('transition_orders'))
        if action == 'destroy':
            return bool(capabilities.get('delete_records'))
        if action in {'create', 'update', 'partial_update'}:
            key = 'create_orders' if getattr(view, 'basename', '') == 'order' else 'manage_catalog'
            return bool(capabilities.get(key))
        return False
