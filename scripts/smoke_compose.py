"""Write tests ONLY for an explicitly named, disposable CI Compose project."""
import argparse
import http.cookiejar
from html.parser import HTMLParser
import json
import os
import re
import secrets
import shutil
from pathlib import Path
import subprocess
import time
import urllib.request
from urllib.parse import urlsplit


class AdminElements(HTMLParser):
    def __init__(self):
        super().__init__()
        self.input_names = set()
        self.form_ids = set()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'input' and values.get('name'):
            self.input_names.add(values['name'])
        if tag == 'form' and values.get('id'):
            self.form_ids.add(values['id'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True)
    parser.add_argument('--browser', action='store_true', help='Run Playwright against this disposable project')
    args = parser.parse_args()
    project = args.project
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
    base = f"http://localhost:{os.getenv('JEDEL_FRONTEND_PORT', '4200')}"
    backend = f"http://localhost:{os.getenv('JEDEL_BACKEND_PORT', '8000')}"

    def request(path, data=None):
        headers = {'Referer':base + '/', 'Origin':base}
        if data is not None:
            client.open(base + '/api/auth/csrf/', timeout=10).close()
            headers.update({'Content-Type':'application/json','X-CSRFToken':next(cookie.value for cookie in jar if cookie.name=='csrftoken')})
        response = client.open(urllib.request.Request(base + path, data=None if data is None else json.dumps(data).encode(), headers=headers), timeout=15)
        return json.load(response)

    email = 'smoke-' + secrets.token_hex(6) + '@example.test'
    username = 'smoke-user-' + secrets.token_hex(6)
    request('/api/auth/register/', {'name':'Fictional CI User','username':username,'email':email,'password':secrets.token_urlsafe(40)})
    assert request('/api/auth/me/')['role'] == 'Basic User'
    catalog = request('/api/catalog/products/')
    assert catalog['count'] == 55, 'Fresh fictional catalog should contain 55 products.'
    for product in catalog['results']:
        assert set(product) == {'product_id', 'product_name', 'category'}
    assert request('/api/ai/capabilities/')['chat_configured'] is False
    results = request('/api/ai/products/search/', {'query': 'Notebook Air 13'})['results']
    assert any('Notebook Air 13' in item['product_name'] for item in results), 'Local AI search did not reach PostgreSQL'
    def counts():
        sql = 'SELECT (SELECT count(*) FROM products), (SELECT count(*) FROM suppliers), (SELECT count(*) FROM purchase_orders), (SELECT count(*) FROM purchase_order_items)'
        result = subprocess.run(['docker', 'compose', '-p', project, 'exec', '-T', 'db', 'psql', '-U', 'jedel_dev', '-d', 'jedel_dev', '-At', '-c', sql], capture_output=True, text=True, check=True)
        return result.stdout.strip()

    assert counts() == '55|4|8|24', 'Unexpected fresh PostgreSQL counts'
    for path in ('/', '/products', '/orders', '/ai-assistant'):
        with client.open(base + path, timeout=15) as response:
            assert response.status == 200
    for path in ('/', '/health/', '/api/docs/'):
        with client.open(backend + path, timeout=15) as response:
            assert response.status == 200
    compose('restart')
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(backend + '/health/', timeout=2) as response:
                assert response.status == 200
            request('/api/auth/me/')
            break
        except (OSError, AssertionError):
            time.sleep(1)
    else:
        raise SystemExit('Services did not recover after isolated restart.')
    assert counts() == '55|4|8|24', 'Counts changed after restart'
    assert request('/api/auth/me/')['email'] == email
    assert request('/api/catalog/products/') == catalog
    request('/api/auth/logout/', {})
    # An unauthenticated admin request must redirect to the real CSRF-protected login form.
    with urllib.request.urlopen(backend + '/admin/', timeout=10) as response:
        assert response.status == 200 and urlsplit(response.geturl()).path == '/admin/login/'
        login_page = AdminElements(); login_page.feed(response.read().decode('utf-8'))
        assert {'username', 'password', 'csrfmiddlewaretoken'} <= login_page.input_names
    request('/api/auth/login/', {'identifier':admin_name,'password':admin_password})
    assert request('/api/auth/me/')['can_administer'] is True
    with client.open(backend + '/admin/', timeout=10) as response:
        assert response.status == 200 and urlsplit(response.geturl()).path == '/admin/'
        admin_page = AdminElements(); admin_page.feed(response.read().decode('utf-8'))
        assert 'logout-form' in admin_page.form_ids
    print('PASS: fresh Compose registration, session, Basic catalog, no-key local capabilities, restart persistence and administrator authentication.')
    if args.browser:
        node = shutil.which('node')
        frontend = Path(__file__).resolve().parents[1] / 'frontend'
        playwright = frontend / 'node_modules/@playwright/test/cli.js'
        if not node or not playwright.is_file():
            raise SystemExit('Install frontend dependencies and Playwright Chromium before the browser smoke.')
        browser_env = os.environ.copy()
        browser_env.update(JEDEL_COMPOSE_BROWSER='1', JEDEL_E2E_URL=base,
                           JEDEL_E2E_ADMIN=admin_name, JEDEL_E2E_PASSWORD=admin_password)
        subprocess.run([node, str(playwright), 'test', 'e2e/compose-workflow.spec.ts'],
                       cwd=frontend, env=browser_env, check=True, timeout=150)



if __name__ == '__main__':
    main()
