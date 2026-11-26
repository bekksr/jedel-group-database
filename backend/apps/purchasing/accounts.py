"""Named accounts. Group assignment is available only to trusted local operators/admins."""
from django.contrib.auth.models import Group
from django.db import connection

ROLES = {
    # Basic User is a legacy group retained for existing account rows. Both
    # names now resolve to the same ordinary User capabilities.
    'User': {'read', 'manage_catalog', 'create_orders'},
    'Basic User': {'read', 'manage_catalog', 'create_orders'},
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

def database_restricted():
    """True if the backend's database role is not a superuser. None if it can't be determined."""
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT rolsuper FROM pg_roles WHERE rolname = current_user")
            row = cur.fetchone()
    except Exception:
        return None
    return None if row is None else not row[0]

def profile(user):
    if hasattr(user, 'capabilities'):
        return {'role': user.role, 'can_write': user.can_write, 'capabilities': user.capabilities}
    caps = capabilities(user)
    roles = list(user.groups.values_list('name', flat=True))
    display_roles = ['User' if role == 'Basic User' else role for role in roles]
    display_roles = list(dict.fromkeys(display_roles))
    data = {'id': user.pk, 'username': user.username, 'name': user.first_name, 'email': user.email,
            'role': ', '.join(display_roles) or ('System Administrator' if user.is_superuser else 'Unassigned'),
            'can_administer': user.is_active and user.is_staff and (user.is_superuser or ('System Administrator' in roles and user.has_perm('auth.view_user') and user.has_perm('auth.change_user'))),
            'can_manage_security': user.is_active and (user.is_superuser or any(role in roles for role in ('Security Administrator', 'System Administrator'))),
            'capabilities': caps, 'can_write': any(value for key, value in caps.items() if key != 'read')}
    if user.is_active and (user.is_superuser or 'System Administrator' in roles):
        data['database_restricted'] = database_restricted()
    return data
