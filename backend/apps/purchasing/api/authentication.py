"""Shared, server-provisioned credential roles, not named-user accounts."""
from dataclasses import dataclass
from django.conf import settings
from django.utils.crypto import constant_time_compare
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed


@dataclass(frozen=True)
class ApiPrincipal:
    can_write: bool
    role: str = 'admin'
    is_authenticated: bool = True

    @property
    def capabilities(self):
        return {
            'manage_catalog': self.can_write and self.role in {'buyer', 'admin'},
            'create_orders': self.can_write and self.role in {'buyer', 'admin'},
            'transition_orders': self.can_write and self.role in {'approver', 'admin'},
            'delete_records': self.can_write and self.role == 'admin',
        }


class EnvironmentTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts:
            return None
        if len(parts) != 2 or parts[0].lower() != b'bearer':
            raise AuthenticationFailed('Use Authorization: Bearer <access token>.')
        try:
            supplied = parts[1].decode('utf-8')
        except UnicodeDecodeError:
            raise AuthenticationFailed('Invalid access token.') from None
        credentials = [
            ('viewer', settings.ERP_READ_TOKEN), ('buyer', settings.ERP_BUYER_TOKEN),
            ('approver', settings.ERP_APPROVER_TOKEN), ('admin', settings.ERP_WRITE_TOKEN),
        ]
        role = None
        # Compare every configured credential; never return credential contents.
        for candidate, token in credentials:
            matches = constant_time_compare(supplied, token)
            if token and matches:
                role = candidate
        if role is None:
            raise AuthenticationFailed('Invalid or unconfigured access token.')
        return ApiPrincipal(can_write=role != 'viewer', role=role), None

    def authenticate_header(self, request):
        return 'Bearer'


from rest_framework.authentication import SessionAuthentication

class AccountSessionAuthentication(SessionAuthentication):
    def authenticate_header(self, request):
        return 'Session'
