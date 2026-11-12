from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
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

class AccountThrottle(SimpleRateThrottle):
    scope = 'login'
    rate = '10/min'
    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}

class RegistrationThrottle(AccountThrottle):
    # Independent IP bucket; authenticated sessions do not bypass either limiter.
    scope = 'registration'

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
            role, _ = Group.objects.get_or_create(name='Basic User')
            if role.permissions.exists():
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
    current = request.data.get('current_password', '')
    new = request.data.get('new_password', '')
    if not isinstance(current, str) or not isinstance(new, str) or len(new) > 128 or not request.user.check_password(current):
        return Response({'detail': 'Current password is invalid.'}, status=400)
    try:
        validate_password(new, request.user)
    except ValidationError as error:
        return Response({'detail': error.messages}, status=400)
    request.user.set_password(new)
    request.user.save(update_fields=['password'])
    update_session_auth_hash(request, request.user)
    return Response({'detail': 'Password changed.'})
