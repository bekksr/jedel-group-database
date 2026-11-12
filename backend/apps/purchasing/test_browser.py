"""Opt-in full browser integration: only the guarded temporary PostgreSQL cluster."""
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.request
from django.conf import settings
from django.contrib.auth.models import User, Group
from django.db import connection
from django.test import override_settings
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from config.test_runner import assert_isolated
from .models import Product, PurchaseOrder, Supplier

@unittest.skipUnless(os.getenv('JEDEL_BROWSER_TESTS') == '1', 'Opt-in: set JEDEL_BROWSER_TESTS=1 and install Playwright Chromium')
class BrowserWorkflowTests(StaticLiveServerTestCase):
    def test_real_browser_workflow(self):
        assert_isolated(connection)
        frontend = Path(settings.BASE_DIR).parent / 'frontend'
        node = shutil.which('node')
        if not node:
            self.fail('Node is required for browser integration tests.')
        from django.core.management import call_command
        call_command('setup_roles', confirm=True)
        password = secrets.token_urlsafe(32)
        User.objects.create_superuser('browser-admin', 'browser-admin@example.test', password)
        manager = User.objects.create_user('browser-manager', password=password)
        manager.groups.add(Group.objects.get(name='Purchasing Manager'))
        hardware = Product.objects.create(product_name='Public catalog hardware', category='Hardware', unit_price='90321.67', stock_quantity=4321)
        Product.objects.create(product_name='Public catalog office', category='Office', unit_price='81234.56', stock_quantity=9876)
        for username, role in [('browser-employee','Purchasing Employee'), ('browser-analyst','Analyst / Tester'), ('browser-basic-pages','Basic User'), ('browser-security','Security Administrator')]:
            user = User.objects.create_user(username, password=password)
            user.groups.add(Group.objects.get(name=role))
        directory_supplier = Supplier.objects.create(supplier_name='Role matrix supplier', email='private-role@example.test', phone='ROLE-PRIVATE-PHONE', address='Private matrix address')
        from .services import create_order
        from django.utils import timezone
        create_order(supplier_id=directory_supplier.pk, order_date=timezone.localdate(), items=[{'product_id': hardware.pk, 'quantity': 1}])
        if os.getenv('JEDEL_VISUAL_PHASE'):
            # Identical synthetic database fixtures for before/after screenshots.
            # No live data or API response substitution is used.
            long_supplier = Supplier.objects.create(supplier_name='Visual supplier with an intentionally long business name for responsive report verification', email='visual-only@example.test')
            visual_product = Product.objects.create(product_name='Visual low-stock fixture with an intentionally long catalog name', category='Visual fixture', unit_price='12.50', stock_quantity=3)
            visual_order = create_order(supplier_id=long_supplier.pk, order_date=timezone.localdate(), items=[{'product_id': visual_product.pk, 'quantity': 3}])
            from .services import transition_order
            transition_order(visual_order.pk, PurchaseOrder.Status.APPROVED)
            transition_order(visual_order.pk, PurchaseOrder.Status.DELIVERED)
        viewer = User.objects.create_user('browser-viewer', password=password)
        viewer.groups.add(Group.objects.get_or_create(name='Analyst / Tester')[0])
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0)); port = probe.getsockname()[1]
        trusted = override_settings(CSRF_TRUSTED_ORIGINS=[f'http://127.0.0.1:{port}'])
        trusted.enable()
        self.addCleanup(trusted.disable)
        env = os.environ.copy()
        env.update(JEDEL_ISOLATED_BROWSER='1', JEDEL_E2E_PASSWORD=password, JEDEL_E2E_URL=f'http://127.0.0.1:{port}', JEDEL_E2E_BACKEND_URL=self.live_server_url)
        flags = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
        with tempfile.TemporaryDirectory(prefix='jedel-browser-') as temp:
            proxy = Path(temp) / 'proxy.json'
            proxy.write_text(json.dumps({'/api/**': {'target': self.live_server_url, 'secure': False, 'changeOrigin': True}}))
            with (Path(temp) / 'angular.log').open('w+', encoding='utf-8') as log:
                process = subprocess.Popen([node, str(frontend / 'node_modules/@angular/cli/bin/ng.js'), 'serve', '--host', '127.0.0.1', '--port', str(port), '--proxy-config', str(proxy)], cwd=frontend, env=env, stdout=log, stderr=subprocess.STDOUT, **flags)
                try:
                    deadline = time.monotonic() + 90
                    while time.monotonic() < deadline:
                        try:
                            urllib.request.urlopen(env['JEDEL_E2E_URL'], timeout=2).close(); break
                        except OSError:
                            if process.poll() is not None:
                                log.seek(0); self.fail('Angular startup failed: ' + log.read())
                            time.sleep(.5)
                    else:
                        log.seek(0); self.fail('Angular startup timed out: ' + log.read())
                    browser_command = [node, str(frontend / 'node_modules/@playwright/test/cli.js'), 'test']
                    if env.get('JEDEL_E2E_GREP'):
                        browser_command += ['--grep', env['JEDEL_E2E_GREP']]
                    result = subprocess.run(browser_command, cwd=frontend, env=env, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=150, **flags)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    print(result.stdout, flush=True)
                finally:
                    if os.name == 'nt' and process.poll() is None:
                        # Stop only the Angular process tree we created. esbuild
                        # inherits the log handle and must exit before temp cleanup.
                        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True, timeout=15, **flags)
                    elif process.poll() is None:
                        process.terminate()
                    try: process.wait(timeout=15)
                    except subprocess.TimeoutExpired: process.kill(); process.wait()
        if os.getenv('JEDEL_E2E_GREP'):
            # Targeted visual capture does not run registration/CRUD scenarios.
            # Full-suite runs retain every post-workflow persistence assertion.
            return
        applicant = User.objects.get(username='browser-applicant@example.test')
        self.assertTrue(applicant.is_active)
        self.assertTrue(applicant.check_password(password))
        self.assertFalse(applicant.is_staff or applicant.is_superuser)
        self.assertEqual(list(applicant.groups.values_list('name', flat=True)), ['Basic User'])
        self.assertEqual(Product.objects.get(product_name='Admin browser product').category, 'Admin verified')
        self.assertTrue(Supplier.objects.filter(supplier_name='Browser supplier').exists())
        self.assertEqual(Product.objects.get(product_name='Browser product').stock_quantity, 3)
        self.assertTrue(PurchaseOrder.objects.filter(status='Delivered').exists())
