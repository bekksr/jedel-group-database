"""Named accounts. Group assignment is available only to trusted local operators/admins."""
from django.contrib.auth.models import Group

ROLES = {
    'Basic User': set(),
    'System Administrator': {'read', 'manage_catalog', 'create_orders', 'transition_orders', 'delete_records'},
    'Purchasing Manager': {'read', 'manage_catalog', 'create_orders', 'transition_orders'},
    'Purchasing Employee': {'read', 'manage_catalog', 'create_orders'},
    'Security Administrator': set(),
    'Analyst / Tester': {'read'},
}

def capabilities(user):
    roles = list(user.groups.values_list('name', flat=True))
    granted = set().union(*(ROLES.get(role, set()) for role in roles))
    if user.is_superuser and user.is_active:
        granted = set().union(*ROLES.values())
    if not user.is_active:
        granted = set()
    return {key: key in granted for key in ('read', 'manage_catalog', 'create_orders', 'transition_orders', 'delete_records')}

def profile(user):
    if hasattr(user, 'capabilities'):
        return {'role': user.role, 'can_write': user.can_write, 'capabilities': user.capabilities}
    caps = capabilities(user)
    roles = list(user.groups.values_list('name', flat=True))
    return {'id': user.pk, 'username': user.username, 'name': user.first_name, 'email': user.email,
            'role': ', '.join(user.groups.values_list('name', flat=True)) or ('System Administrator' if user.is_superuser else 'Unassigned'),
            'can_administer': user.is_active and user.is_staff and (user.is_superuser or ('System Administrator' in roles and user.has_perm('auth.view_user') and user.has_perm('auth.change_user'))),
            'can_manage_security': user.is_active and (user.is_superuser or any(role in roles for role in ('Security Administrator', 'System Administrator'))),
            'capabilities': caps, 'can_write': any(value for key, value in caps.items() if key != 'read')}
