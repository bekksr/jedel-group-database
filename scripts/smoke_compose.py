"""Write tests ONLY for an explicitly named, disposable CI Compose project."""
import argparse
import http.cookiejar
import json
import os
import re
import secrets
import subprocess
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True)
    project = parser.parse_args().project
    if os.getenv('JEDEL_COMPOSE_SMOKE') != '1' or not re.fullmatch(r'jedel-ci-[a-z0-9-]+', project):
        raise SystemExit('Refusing writes outside explicitly opted-in disposable jedel-ci-* project.')

    def compose(*args, **kwargs):
        return subprocess.run(['docker', 'compose', '-p', project, *args], check=True, **kwargs)

    # Verify isolation inside the target container before any user creation.
    bootstrap = """import os,json,sys; os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings'); import django; django.setup()
from django.conf import settings
from django.db import connection
assert settings.DATABASES['default']['NAME']=='jedel_dev' and settings.DATABASES['default']['HOST']=='db'
assert os.getenv('JEDEL_ISOLATED_DEVELOPMENT')=='1'
from django.contrib.auth.models import User
data=json.loads(sys.stdin.read())
User.objects.create_superuser(data['username'],data['email'],data['password'])
print('Disposable administrator bootstrap verified; credential not displayed.')
"""
    admin_password = secrets.token_urlsafe(40)
    admin_name = 'smoke-admin-' + secrets.token_hex(4)
    compose('exec', '-T', 'backend', 'python', '-c', bootstrap,
            input=json.dumps({'username':admin_name, 'email':admin_name+'@example.test', 'password':admin_password}), text=True)
    jar = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    base = 'http://localhost:4200'

    def request(path, data=None):
        headers = {'Referer':base + '/'}
        if data is not None:
            client.open(base + '/api/auth/csrf/', timeout=10).close()
            headers.update({'Content-Type':'application/json','X-CSRFToken':next(cookie.value for cookie in jar if cookie.name=='csrftoken')})
        response = client.open(urllib.request.Request(base + path, data=None if data is None else json.dumps(data).encode(), headers=headers), timeout=15)
        return json.load(response)

    email = 'smoke-' + secrets.token_hex(6) + '@example.test'
    request('/api/auth/register/', {'name':'Fictional CI User','email':email,'password':secrets.token_urlsafe(40)})
    assert request('/api/auth/me/')['role'] == 'Basic User'
    catalog = request('/api/catalog/products/')
    for product in catalog['results']:
        assert set(product) == {'product_id', 'product_name', 'category'}
    assert request('/api/ai/capabilities/')['chat_configured'] is False
    compose('restart')
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen('http://localhost:8000/health/', timeout=2) as response:
                assert response.status == 200
            request('/api/auth/me/')
            break
        except (OSError, AssertionError):
            time.sleep(1)
    else:
        raise SystemExit('Services did not recover after isolated restart.')
    assert request('/api/auth/me/')['email'] == email
    assert request('/api/catalog/products/') == catalog
    request('/api/auth/logout/', {})
    request('/api/auth/login/', {'identifier':admin_name,'password':admin_password})
    assert request('/api/auth/me/')['can_administer'] is True
    with client.open('http://localhost:8000/admin/', timeout=10) as response:
        assert response.status == 200
        assert b'Site administration' in response.read()
    print('PASS: fresh Compose registration, session, Basic catalog, no-key local capabilities, restart persistence and administrator authentication.')


if __name__ == '__main__':
    main()
