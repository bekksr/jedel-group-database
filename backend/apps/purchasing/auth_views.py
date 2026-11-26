from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from urllib.parse import quote
import logging
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.middleware.csrf import get_token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.exceptions import APIException
from django.conf import settings
from rest_framework.authentication import SessionAuthentication
from .accounts import profile
from .account_serializers import RegistrationSerializer, LoginSerializer

logger = logging.getLogger(__name__)

class AccountThrottle(SimpleRateThrottle):
    scope = 'login'
    rate = '10/min'
    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}

class RegistrationThrottle(AccountThrottle):
    # Independent IP bucket; authenticated sessions do not bypass either limiter.
    scope = 'registration'

class PasswordResetThrottle(AccountThrottle):
    scope = 'password_reset'
    rate = '5/hour'

class PasswordResetConfirmThrottle(AccountThrottle):
    scope = 'password_reset_confirm'
    rate = '20/hour'

class DefaultRoleUnavailable(APIException):
    status_code = 503
    default_detail = 'The default account role is not configured safely. Contact the administrator.'


@api_view(['GET'])
@permission_classes([AllowAny])
def csrf(request):
    return Response({'csrfToken': get_token(request)})

# Anonymous login and registration explicitly enforce CSRF; DRF session auth enforces it only for signed-in users.
@api_view(['POST'])
@permission_classes([AllowAny])
def sign_in(request):
    SessionAuthentication().enforce_csrf(request)
    throttle = AccountThrottle()
    if not throttle.allow_request(request, None):
        return Response({'detail': 'Too many attempts. Try again later.'}, status=429)
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    user = authenticate(request, username=values['identifier'], password=values['password'])
    if user is None:
        return Response({'detail': 'Invalid credentials or disabled account.'}, status=400)
    login(request, user)
    return Response(profile(user))

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    SessionAuthentication().enforce_csrf(request)
    throttle = RegistrationThrottle()
    if not throttle.allow_request(request, None):
        return Response({'detail': 'Too many attempts. Try again later.'}, status=429)
    serializer = RegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    try:
        with transaction.atomic():
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(%s)', [74832910])
            if User.objects.filter(Q(email__iexact=values['email']) | Q(username__iexact=values['email']) | Q(username=values['username']) | Q(email__iexact=values['username'])).exists():
                return Response({'detail': ['Account already exists.']}, status=400)
            # Prefer the new group. Existing deployments may only have the
            # legacy Basic User group; it maps to the same capabilities.
            role = Group.objects.filter(name='User').first() or Group.objects.filter(name='Basic User').first()
            from .management.commands.setup_roles import intended_permissions
            expected = intended_permissions('User')
            existing = set() if role is None else {
                permission.content_type.app_label + '.' + permission.codename
                for permission in role.permissions.select_related('content_type')
            }
            unsafe = existing - expected
            not_ready = role is None or (role.name == 'User' and expected - existing)
            if not_ready or unsafe:
                raise DefaultRoleUnavailable()
            user = User.objects.create_user(username=values['username'], email=values['email'], first_name=values['name'], password=values['password'], is_active=True)
            user.groups.add(role)
            login(request, user, backend=settings.AUTHENTICATION_BACKENDS[0])
            # Force database session creation before committing the account. A
            # missing/broken session table rolls back the new user and membership.
            request.session.save()
            account = profile(user)
    except IntegrityError:
        return Response({'detail': ['Account already exists.']}, status=400)
    return Response({'detail': 'Account created successfully. Welcome to Jedel.Group!', 'user': account}, status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sign_out(request):
    logout(request)
    return Response({'detail': 'Signed out.'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(profile(request.user))

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def edit_profile(request):
    if set(request.data) - {'name'}:
        return Response({'detail': 'Only name can be edited here.'}, status=400)
    name = request.data.get('name')
    if not isinstance(name, str) or not name.strip() or len(name) > 100:
        return Response({'detail': 'Enter a name of 1 to 100 characters.'}, status=400)
    request.user.first_name = name.strip()
    request.user.save(update_fields=['first_name'])
    return Response(profile(request.user))

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def password(request):
    if not isinstance(request.data, dict) or set(request.data) - {'current_password', 'new_password', 'new_password_confirm'}:
        return Response({'detail': 'Provide only the current password, new password, and its confirmation.'}, status=400)
    current = request.data.get('current_password', '')
    new = request.data.get('new_password', '')
    confirm = request.data.get('new_password_confirm', '')
    if not isinstance(current, str) or not isinstance(new, str) or not isinstance(confirm, str) or len(new) > 128:
        return Response({'detail': 'Enter the current password, a valid new password, and its confirmation.'}, status=400)
    if not request.user.check_password(current):
        return Response({'detail': 'Current password is invalid.'}, status=400)
    if not new or new != confirm:
        return Response({'detail': 'New password and confirmation must match.'}, status=400)
    try:
        validate_password(new, request.user)
    except ValidationError as error:
        return Response({'detail': error.messages}, status=400)
    request.user.set_password(new)
    request.user.save(update_fields=['password'])
    update_session_auth_hash(request, request.user)
    return Response({'detail': 'Password changed.'})

def _public_reset_ack():
    return Response({'detail': 'If an account matches that email address, password reset instructions will be sent.'})

@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    SessionAuthentication().enforce_csrf(request)
    throttle = PasswordResetThrottle()
    if not throttle.allow_request(request, None):
        return Response({'detail': 'Too many attempts. Try again later.'}, status=429)
    email = request.data.get('email', '') if isinstance(request.data, dict) else ''
    if not isinstance(email, str) or len(email) > 254:
        return _public_reset_ack()
    try:
        validate_email(email)
        matches = list(User.objects.filter(email__iexact=email).order_by('pk')[:2])
    except (ValidationError, ValueError, TypeError):
        return _public_reset_ack()
    # Legacy data may contain duplicate case-insensitive emails. Never guess.
    if len(matches) != 1 or not matches[0].is_active or not matches[0].has_usable_password():
        return _public_reset_ack()
    user = matches[0]
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    reset_url = f"{settings.FRONTEND_BASE_URL}/password-reset/confirm/{quote(uid, safe='')}/{quote(token, safe='')}"
    message = f"A password reset was requested for your Jedel.Group account.\n\nOpen this link to set a new password (valid for 30 minutes and usable once):\n{reset_url}\n\nIf you did not request this, you can ignore this email."
    try:
        delivered = send_mail('Reset your Jedel.Group password', message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
        if delivered == 1:
            logger.info('Password reset message accepted by the configured email backend.')
        else:
            logger.warning('Password reset message was not accepted by the configured email backend.')
    except Exception:
        # Do not log the email address, token, full URL, or SMTP exception details.
        logger.warning('Password reset email delivery failed.')
    return _public_reset_ack()

@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    SessionAuthentication().enforce_csrf(request)
    throttle = PasswordResetConfirmThrottle()
    if not throttle.allow_request(request, None):
        return Response({'detail': 'Too many attempts. Try again later.'}, status=429)
    data = request.data if isinstance(request.data, dict) else {}
    uid, token = data.get('uid', ''), data.get('token', '')
    password_value, confirm = data.get('new_password', ''), data.get('new_password_confirm', '')
    if not all(isinstance(value, str) for value in (uid, token, password_value, confirm)) or len(uid) > 64 or len(token) > 128 or len(password_value) > 128:
        return Response({'detail': 'The reset link is invalid or expired, or the password fields are invalid.'}, status=400)
    try:
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id, is_active=True)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None
    if user is None or not default_token_generator.check_token(user, token):
        return Response({'detail': 'The reset link is invalid or expired, or the password fields are invalid.'}, status=400)
    if not password_value or password_value != confirm:
        return Response({'detail': 'New password and confirmation must match.'}, status=400)
    try:
        validate_password(password_value, user)
    except ValidationError as error:
        return Response({'detail': error.messages}, status=400)
    user.set_password(password_value)
    user.save(update_fields=['password'])
    return Response({'detail': 'Password reset successfully.'})
