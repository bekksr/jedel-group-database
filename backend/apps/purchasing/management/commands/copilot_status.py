"""Print presence/validity only. Never authenticates to a provider or reads records."""
import importlib.metadata
import json
import os
import re
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand
from apps.purchasing.copilot.provider import configured, readiness


def status_report():
    path = Path(settings.BASE_DIR) / '.env'
    entries = set()
    if path.is_file():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            match = re.match(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=', line)
            if match: entries.add(match.group(1))
    result = {}
    for name in ('AI_ENABLED', 'AI_PROVIDER', 'AI_MODEL', 'GROQ_API_KEY', 'AI_TIMEOUT_SECONDS', 'AI_MAX_OUTPUT_TOKENS', 'AI_DAILY_CALL_LIMIT', 'AI_USER_DAILY_CALL_LIMIT', 'AI_CHAT_REQUESTS_PER_MINUTE'):
        value = getattr(settings, name, None)
        state = 'missing' if value is None or value == '' else 'present'
        if name == 'AI_ENABLED':
            state = 'enabled' if value else 'disabled'
            if os.getenv(name, 'false').lower() not in ('true', 'false'): state = 'invalid boolean'
        if name == 'AI_PROVIDER' and value != 'groq': state = 'invalid: unsupported provider'
        if name == 'AI_MODEL' and isinstance(value, str) and value: state = 'present; provider availability unverified' if value == 'openai/gpt-oss-20b' else 'invalid: unsupported model'
        if name == 'GROQ_API_KEY' and isinstance(value, str) and value:
            state = 'invalid: whitespace' if any(c.isspace() for c in value) else 'present; not authenticated'
        result[name] = {'status': state, 'env_file_entry': 'present' if name in entries else 'missing'}
    try: sdk = importlib.metadata.version('openai')
    except importlib.metadata.PackageNotFoundError: sdk = 'missing in this interpreter'
    return {'env_file': 'backend/.env', 'env_file_status': 'present' if path.is_file() else 'missing',
            'dotenv_loading': 'enabled' if os.getenv('JEDEL_LOAD_DOTENV', 'true').lower() != 'false' else 'disabled',
            'settings': result, 'compatible_sdk': sdk, 'provider': settings.AI_PROVIDER if settings.AI_PROVIDER == 'groq' else 'unsupported', 'model': settings.AI_MODEL if settings.AI_MODEL == 'openai/gpt-oss-20b' else 'unsupported or missing', 'local_tools_available': True, 'provider_configuration_complete': configured(),
            'runtime_status': readiness(),
            'note': 'No credentials displayed or authenticated. No provider/network calls or database queries. Existing process environment overrides .env.'}


class Command(BaseCommand):
    help = 'Read-only Copilot configuration status, without credential values or API calls.'
    def handle(self, *args, **options):
        self.stdout.write(json.dumps(status_report(), indent=2))
