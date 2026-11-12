"""Load private backend/.env values without overriding process configuration.

Values are literal strings; no interpolation or shell execution is performed.
Use JSON double quoting for values containing quotes, newlines or backslashes.
"""
import json
import os
import re
from django.core.exceptions import ImproperlyConfigured


def load_environment(path):
    if not path.is_file():
        return
    values = {}
    for number, line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, separator, value = line.partition('=')
        key = key.strip()
        if not separator or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key):
            raise ImproperlyConfigured(f'Invalid local .env syntax at line {number}; use KEY=value.')
        value = value.strip()
        if value.startswith('"'):
            try:
                value = json.loads(value)
                if not isinstance(value, str):
                    raise ValueError()
            except (ValueError, TypeError):
                raise ImproperlyConfigured(f'Invalid quoted .env value at line {number}.') from None
        elif value.startswith("'"):
            if len(value) < 2 or not value.endswith("'"):
                raise ImproperlyConfigured(f'Invalid quoted .env value at line {number}.')
            value = value[1:-1]
        values[key] = value
    for key, value in values.items():
        os.environ.setdefault(key, value)
