import os
import secrets
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured('Set DJANGO_SECRET_KEY when DJANGO_DEBUG=false.')
    # Ephemeral development key: no stored or shared credentials.
    SECRET_KEY = secrets.token_urlsafe(64)

def env_list(name, default):
    return [value.strip() for value in os.getenv(name, default).split(',') if value.strip()]

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,[::1]')
INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'rest_framework',
    'corsheaders',
    'apps.purchasing.apps.PurchasingConfig',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'apps.purchasing.api.middleware.ApiCachePolicyMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
]
ROOT_URLCONF = 'config.urls'
TEMPLATES = []
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'jedel_group_db').strip(),
        'HOST': os.getenv('DB_HOST', '127.0.0.1').strip(),
        'PORT': os.getenv('DB_PORT', '5432').strip(),
        # A missing password must fail rather than fall back to a local account.
        'USER': os.getenv('DB_USER', '').strip(),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'OPTIONS': {'connect_timeout': 5, 'passfile': '', 'sslmode': os.getenv('DB_SSLMODE', 'prefer')},
    },
}
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', 'http://localhost:4200,http://127.0.0.1:4200')
CORS_URLS_REGEX = r'^/api/.*$'
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated', 'apps.purchasing.api.permissions.ReadOrWriteAccess'],
    'DEFAULT_AUTHENTICATION_CLASSES': ['apps.purchasing.api.authentication.EnvironmentTokenAuthentication'],
    'EXCEPTION_HANDLER': 'apps.purchasing.api.exceptions.exception_handler',
    'DEFAULT_PARSER_CLASSES': ['apps.purchasing.api.parsers.LimitedJSONParser'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
}
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Qyzylorda'
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Credential roles are enforced by Django; none require schema changes.
ERP_READ_TOKEN = os.getenv('ERP_READ_TOKEN', '')       # Viewer (legacy alias)
ERP_WRITE_TOKEN = os.getenv('ERP_WRITE_TOKEN', '')     # Admin (legacy alias)
ERP_BUYER_TOKEN = os.getenv('ERP_BUYER_TOKEN', '')
ERP_APPROVER_TOKEN = os.getenv('ERP_APPROVER_TOKEN', '')
configured_tokens = [token for token in (ERP_READ_TOKEN, ERP_WRITE_TOKEN, ERP_BUYER_TOKEN, ERP_APPROVER_TOKEN) if token]
if any(len(token) < 32 or any(char.isspace() for char in token) for token in configured_tokens):
    raise ImproperlyConfigured('API tokens must have at least 32 characters and no whitespace.')
if len(configured_tokens) != len(set(configured_tokens)):
    raise ImproperlyConfigured('Each credential role must have a distinct API token.')
DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024
CORS_ALLOW_CREDENTIALS = False
SECURE_CONTENT_TYPE_NOSNIFF = True
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    # Domain-wide HSTS/preload require explicit ownership and deployment review.
    SECURE_HSTS_INCLUDE_SUBDOMAINS = os.getenv('DJANGO_HSTS_INCLUDE_SUBDOMAINS', 'false').lower() == 'true'
    SECURE_HSTS_PRELOAD = os.getenv('DJANGO_HSTS_PRELOAD', 'false').lower() == 'true'
TEST_RUNNER = 'config.test_runner.IsolatedPostgresRunner'
DATABASES['default']['TEST'] = {'NAME': os.getenv('TEST_DB_NAME', 'test_jedel_api')}

X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'same-origin'
