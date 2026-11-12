from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.core.cache import cache
from rest_framework.test import APIClient
from .models import Product

class AccountTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.password = 'Unique-test-password-938!xyz'
        self.user = User.objects.create_user('employee', password=self.password, email='employee@example.test')
        self.user.groups.add(Group.objects.get_or_create(name='Purchasing Employee')[0])

    def csrf(self):
        self.client.get('/api/auth/csrf/')
        return {'HTTP_X_CSRFTOKEN': self.client.cookies['csrftoken'].value}

    def login(self):
        response = self.client.post('/api/auth/login/', {'username': 'employee', 'password': self.password}, **self.csrf())
        self.assertEqual(response.status_code, 200, response.content)
        return self.csrf()

    def test_login_requires_csrf_even_for_anonymous_users(self):
        self.assertEqual(self.client.post('/api/auth/login/', {'username': 'employee', 'password': self.password}).status_code, 403)

    def test_registration_activation_hashing_session_and_privilege_escalation(self):
        data = {'name': 'Team Member', 'email': 'team@example.test', 'password': self.password, 'password_confirm': self.password}
        self.assertEqual(self.client.post('/api/auth/register/', data).status_code, 403)
        for forbidden in [{'is_superuser': True}, {'role': 'System Administrator'}, {'groups': ['Purchasing Manager']}, {'is_staff': True}]:
            self.assertEqual(self.client.post('/api/auth/register/', {**data, **forbidden}, **self.csrf()).status_code, 400)
        response = self.client.post('/api/auth/register/', data, **self.csrf())
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username=data['email'])
        self.assertTrue(user.check_password(self.password))
        self.assertNotEqual(user.password, self.password)
        self.assertTrue(user.is_active); self.assertFalse(user.is_staff or user.is_superuser)
        self.assertEqual(list(user.groups.values_list('name',flat=True)), ['Basic User'])
        self.assertEqual(response.data['user']['role'], 'Basic User')
        self.assertFalse(any(response.data['user']['capabilities'].values()))
        self.assertEqual(self.client.get('/api/auth/me/').data['id'], user.pk)
        restored = APIClient(); restored.cookies = self.client.cookies.copy()
        self.assertEqual(restored.get('/api/auth/me/').data['id'], user.pk)
        self.assertEqual(self.client.post('/api/auth/register/', data, **self.csrf()).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/register/', {**data, 'email': data['email'].upper()}, **self.csrf()).status_code, 400)
        for path in ['/api/products/', '/api/suppliers/', '/api/orders/', '/api/analytics/supplier-spending/', '/api/security/accounts/']:
            self.assertEqual(self.client.get(path).status_code, 403, path)
        self.assertEqual(self.client.post('/api/orders/999/approve/', {}, **self.csrf()).status_code, 403)
        self.assertEqual(self.client.post('/api/orders/999/deliver/', {}, **self.csrf()).status_code, 403)
        self.assertEqual(self.client.get('/admin/').status_code, 302)
        self.assertEqual(self.client.post('/api/auth/logout/', {}, **self.csrf()).status_code, 200)
        self.assertEqual(restored.get('/api/auth/me/').status_code, 401)

    def test_session_persistence_logout_and_disabled_account(self):
        headers = self.login()
        restored = APIClient(); restored.cookies = self.client.cookies.copy()
        self.assertEqual(restored.get('/api/auth/me/').data['username'], 'employee')
        self.assertEqual(self.client.post('/api/auth/logout/', {}, **headers).status_code, 200)
        self.assertEqual(restored.get('/api/auth/me/').status_code, 401)
        self.user.is_active = False; self.user.save()
        self.assertEqual(self.client.post('/api/auth/login/', {'username': 'employee', 'password': self.password}, **self.csrf()).status_code, 400)

    def test_profile_password_and_role_escalation(self):
        headers = self.login()
        self.assertEqual(self.client.patch('/api/auth/profile/', {'name': 'New Name'}, **headers).status_code, 200)
        self.assertEqual(self.client.patch('/api/auth/profile/', {'is_staff': True}, **headers).status_code, 400)
        url = '/api/auth/password/'
        self.assertEqual(self.client.post(url, {'current_password': 'wrong', 'new_password': 'Another-secure-928!xyz'}, **headers).status_code, 400)
        self.assertEqual(self.client.post(url, {'current_password': self.password, 'new_password': 'Another-secure-928!xyz'}, **headers).status_code, 200)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)
        self.user.refresh_from_db(); self.assertTrue(self.user.check_password('Another-secure-928!xyz'))

    def test_roles_csrf_and_admin_boundaries(self):
        headers = self.login()
        self.assertEqual(self.client.post('/api/products/', {'product_name': 'CSRF denied', 'unit_price': '1.00'}).status_code, 403)
        self.assertEqual(self.client.post('/api/products/', {'product_name': 'Allowed', 'unit_price': '1.00'}, **headers).status_code, 201)
        self.assertEqual(self.client.post('/api/orders/999/approve/', {}, **headers).status_code, 403)
        self.assertEqual(self.client.get('/admin/').status_code, 302)
        self.user.groups.clear(); self.user.groups.add(Group.objects.get_or_create(name='Security Administrator')[0])
        self.assertEqual(self.client.get('/api/products/').status_code, 403)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)
        self.user.groups.clear(); self.user.groups.add(Group.objects.get_or_create(name='Analyst / Tester')[0])
        self.assertEqual(self.client.get('/api/products/').status_code, 200)
        self.assertEqual(self.client.post('/api/products/', {}, **headers).status_code, 403)
        self.user.is_active = False; self.user.save()
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_login_throttle_and_invalid_credentials(self):
        headers = self.csrf()
        for _ in range(10):
            self.assertEqual(self.client.post('/api/auth/login/', {'username': 'employee', 'password': 'wrong'}, **headers).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/login/', {}, **headers).status_code, 429)

    def test_shared_bearer_is_not_an_account_bypass(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + 'a' * 40)
        self.assertEqual(self.client.get('/api/products/').status_code, 401)

    def test_admin_cannot_edit_stock_or_order_status(self):
        from django.contrib import admin
        from .models import PurchaseOrder
        from django.test import RequestFactory
        self.user.is_superuser = True; self.user.is_staff = True; self.user.save()
        request = RequestFactory().get('/admin/'); request.user = self.user
        for model in (PurchaseOrder,):
            model_admin = admin.site._registry[model]
            self.assertFalse(model_admin.has_change_permission(request))
            self.assertFalse(model_admin.has_delete_permission(request))
            self.assertFalse(model_admin.has_add_permission(request))
            self.assertTrue(model_admin.has_view_permission(request))

    def test_delegated_security_access_cannot_escalate_or_access_business_data(self):
        security = User.objects.create_user('security', password=self.password)
        security.groups.add(Group.objects.get_or_create(name='Security Administrator')[0])
        self.client.force_login(security)
        headers = self.csrf()
        self.assertEqual(self.client.get('/api/products/').status_code, 403)
        self.assertEqual(self.client.get('/api/security/accounts/').status_code, 200)
        target = f'/api/security/accounts/{self.user.pk}/'
        self.assertEqual(self.client.patch(target, {'is_active': False}, **headers).status_code, 200)
        self.user.refresh_from_db(); self.assertFalse(self.user.is_active)
        self.assertEqual(self.client.patch(target, {'is_active': True, 'is_superuser': True}, **headers).status_code, 400)
        self.assertEqual(self.client.patch(f'/api/security/accounts/{security.pk}/', {'is_active': False}, **headers).status_code, 403)
        privileged = User.objects.create_superuser('protected-admin', password=self.password)
        self.assertEqual(self.client.patch(f'/api/security/accounts/{privileged.pk}/', {'is_active': False}, **headers).status_code, 403)
        applicant = User.objects.create_user('unassigned-applicant', is_active=False)
        self.assertEqual(self.client.patch(f'/api/security/accounts/{applicant.pk}/', {'is_active': True}, **headers).status_code, 403)
        self.assertEqual(self.client.patch(target, {'is_active': True}, **headers).status_code, 200)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/api/security/accounts/').status_code, 403)

    def test_development_initializer_refuses_project_database(self):
        from django.core.management import call_command, CommandError
        from unittest.mock import patch
        with patch.dict('os.environ', {'JEDEL_ISOLATED_DEVELOPMENT': '1'}):
            with self.assertRaises(CommandError):
                call_command('init_development')

    def test_documentation_and_backend_interfaces(self):
        self.assertEqual(self.client.get('/').status_code, 200)
        self.assertEqual(self.client.get('/health/').status_code, 200)
        self.assertEqual(self.client.get('/api/docs/').status_code, 200)
        schema = self.client.get('/api/schema/').json()
        self.assertEqual(schema['openapi'], '3.1.0')
        self.assertIn('/api/auth/login/', schema['paths'])

    def test_registration_rejects_invalid_username_and_weak_password(self):
        headers = self.csrf()
        for data in ({'username': 'invalid username!', 'email': 'invalid@example.test', 'password': self.password}, {'email': 'weak@example.test', 'password': '12345678'}):
            self.assertEqual(self.client.post('/api/auth/register/', data, **headers).status_code, 400)

    def test_trusted_system_administrator_can_manage_users_with_explicit_staff(self):
        from django.core.management import call_command
        call_command('setup_roles', confirm=True)
        self.user.groups.clear()
        self.user.groups.add(Group.objects.get(name='System Administrator'))
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/admin/auth/user/').status_code, 302)
        self.user.is_staff = True; self.user.save()
        self.assertEqual(self.client.get('/admin/auth/user/').status_code, 200)
        self.assertEqual(self.client.get('/admin/auth/user/add/').status_code, 200)
        self.assertFalse(self.user.is_superuser)

    def test_confirmation_is_checked_and_database_failure_has_safe_message(self):
        from unittest.mock import patch
        from django.db import ProgrammingError
        from types import SimpleNamespace
        headers = self.csrf()
        response = self.client.post('/api/auth/register/', {'name': 'Applicant', 'email': 'confirm@example.test', 'password': self.password, 'password_confirm': 'different'}, **headers)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email='confirm@example.test').exists())
        error = ProgrammingError('secret database internals')
        cause = Exception()
        cause.pgcode = '42P01'
        error.__cause__ = cause
        with patch('django.contrib.auth.models.User.objects.filter', side_effect=error):
            response = self.client.post('/api/auth/register/', {'name': 'Applicant', 'email': 'failure@example.test', 'password': self.password}, **headers)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'authentication_setup_required')
        self.assertNotIn('secret', str(response.data))

    def test_admin_missing_schema_returns_safe_setup_response(self):
        from unittest.mock import patch
        with patch('apps.purchasing.admin_availability.connection.cursor') as cursor:
            cursor.return_value.__enter__.return_value.fetchone.return_value = (None, None, None, None)
            response = self.client.get('/admin/')
        self.assertEqual(response.status_code, 503)
        self.assertContains(response, 'Administration is not ready', status_code=503)
        self.assertNotContains(response, 'auth_user', status_code=503)

    def test_email_login_is_case_insensitive_and_preserves_legacy_username_login(self):
        headers = self.csrf()
        response = self.client.post('/api/auth/login/', {'identifier': 'EMPLOYEE@EXAMPLE.TEST', 'password': self.password}, **headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], 'employee')
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 200)
        self.assertEqual(self.client.post('/api/auth/logout/', {}, **self.csrf()).status_code, 200)
        self.assertEqual(self.client.post('/api/auth/login/', {'username': 'employee', 'password': self.password}, **self.csrf()).status_code, 200)

    def test_ambiguous_legacy_emails_and_email_username_collisions_fail_closed(self):
        User.objects.create_user('another-employee', email='EMPLOYEE@example.test', password=self.password)
        headers = self.csrf()
        self.assertEqual(self.client.post('/api/auth/login/', {'identifier': 'employee@example.test', 'password': self.password}, **headers).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/login/', {'identifier': 'employee', 'password': self.password}, **headers).status_code, 200)
        self.client.post('/api/auth/logout/', {}, **self.csrf())
        User.objects.filter(username='another-employee').delete()
        User.objects.create_user('employee@example.test', email='separate@example.test', password=self.password)
        self.assertEqual(self.client.post('/api/auth/login/', {'identifier': 'employee@example.test', 'password': self.password}, **self.csrf()).status_code, 400)

    def test_email_login_rejects_pending_disabled_and_wrong_password(self):
        for active, password in [(False, self.password), (True, 'wrong')]:
            self.user.is_active = active; self.user.save()
            self.assertEqual(self.client.post('/api/auth/login/', {'email': 'employee@example.test', 'password': password}, **self.csrf()).status_code, 400)

    def test_login_rejects_conflicting_identifiers_or_non_object_payload(self):
        headers = self.csrf()
        for body in [{'identifier': 'employee', 'email': 'employee@example.test', 'password': self.password}, ['not-an-object']]:
            self.assertEqual(self.client.post('/api/auth/login/', body, format='json', **headers).status_code, 400)

    def test_registered_user_with_distinct_username_can_login_by_email_immediately(self):
        data = {'username': 'distinct-applicant', 'name': 'Applicant', 'email': 'distinct@example.test', 'password': self.password, 'password_confirm': self.password}
        self.assertEqual(self.client.post('/api/auth/register/', data, **self.csrf()).status_code, 201)
        user = User.objects.get(username='distinct-applicant')
        self.assertTrue(user.check_password(self.password)); self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff or user.is_superuser)
        self.client.post('/api/auth/logout/', {}, **self.csrf())
        credentials = {'identifier': 'DISTINCT@EXAMPLE.TEST', 'password': self.password}
        self.assertEqual(self.client.post('/api/auth/login/', credentials, **self.csrf()).status_code, 200)
        self.assertEqual(self.client.get('/api/auth/me/').data['username'], 'distinct-applicant')

    def test_admin_review_requires_role_and_rejection_disables_without_privilege_changes(self):
        operator = User.objects.create_superuser('review-admin', password=self.password)
        applicant = User.objects.create_user('review-applicant', email='review@example.test', password=self.password, is_active=False)
        self.client.force_login(operator)
        headers = self.csrf()
        url = '/admin/auth/user/'
        action = {'action': 'approve_accounts', '_selected_action': [str(applicant.pk)], 'index': '0'}
        self.assertEqual(self.client.post(url, action, format='multipart', **headers).status_code, 302)
        applicant.refresh_from_db(); self.assertFalse(applicant.is_active)
        applicant.groups.add(Group.objects.get_or_create(name='Purchasing Employee')[0])
        self.assertEqual(self.client.post(url, action, format='multipart', **headers).status_code, 302)
        applicant.refresh_from_db(); self.assertTrue(applicant.is_active)
        self.assertFalse(applicant.is_staff or applicant.is_superuser)
        action['action'] = 'reject_accounts'
        self.assertEqual(self.client.post(url, action, format='multipart', **headers).status_code, 302)
        applicant.refresh_from_db(); self.assertFalse(applicant.is_active)
        self.assertTrue(applicant.check_password(self.password))

    def test_session_creation_failure_rolls_back_registration(self):
        from unittest.mock import patch
        from django.db import OperationalError
        data = {'name': 'Rollback User', 'email': 'rollback-user@example.test', 'password': self.password}
        with patch('django.contrib.sessions.backends.db.SessionStore.save', side_effect=OperationalError('private session error')):
            response = self.client.post('/api/auth/register/', data, **self.csrf())
        self.assertEqual(response.status_code, 503)
        self.assertFalse(User.objects.filter(email=data['email']).exists())
        self.assertNotIn('private session error', str(response.data))

    def test_registration_does_not_activate_existing_pending_accounts(self):
        pending = User.objects.create_user('old-pending', email='old-pending@example.test', password=self.password, is_active=False)
        self.assertEqual(self.client.post('/api/auth/register/', {'name': 'New User', 'email': 'new-policy@example.test', 'password': self.password}, **self.csrf()).status_code, 201)
        pending.refresh_from_db(); self.assertFalse(pending.is_active)
        self.assertEqual(pending.groups.count(), 0)
        self.user.refresh_from_db(); self.assertTrue(self.user.is_active)
        self.assertTrue(self.user.groups.filter(name='Purchasing Employee').exists())

    def test_misconfigured_default_group_rejects_registration_without_escalation(self):
        from django.contrib.auth.models import Permission
        group, _ = Group.objects.get_or_create(name='Basic User')
        group.permissions.add(Permission.objects.first())
        response = self.client.post('/api/auth/register/', {'name': 'Unsafe Role', 'email': 'unsafe-role@example.test', 'password': self.password}, **self.csrf())
        self.assertEqual(response.status_code, 503)
        self.assertFalse(User.objects.filter(email='unsafe-role@example.test').exists())

    def test_registration_throttle_applies_after_automatic_login(self):
        from unittest.mock import patch
        headers = self.csrf()
        # Exercise the actual cache limiter without spending time hashing ten accounts.
        from .auth_views import RegistrationThrottle
        from rest_framework.test import APIRequestFactory, force_authenticate
        from rest_framework.request import Request
        request = Request(APIRequestFactory().post('/api/auth/register/'))
        request.user = self.user
        throttle = RegistrationThrottle()
        for _ in range(10): self.assertTrue(throttle.allow_request(request,None))
        self.assertFalse(throttle.allow_request(request,None))
        response = self.client.post('/api/auth/register/', {'name': 'Limited', 'email': 'limited@example.test', 'password': self.password}, **headers)
        self.assertEqual(response.status_code, 429)

    def test_authenticated_users_cannot_bypass_login_throttling(self):
        from .auth_views import AccountThrottle
        from rest_framework.test import APIRequestFactory
        from rest_framework.request import Request
        self.client.force_login(self.user)
        request = Request(APIRequestFactory().post('/api/auth/login/')); request.user = self.user
        throttle = AccountThrottle()
        for _ in range(10): self.assertTrue(throttle.allow_request(request,None))
        response = self.client.post('/api/auth/login/', {'identifier': 'employee', 'password': 'wrong'}, **self.csrf())
        self.assertEqual(response.status_code, 429)

    def test_public_registration_cannot_create_email_username_collisions_with_existing_accounts(self):
        legacy = User.objects.create_user('legacy@example.test', email='other-legacy@example.test', password=self.password)
        for body in [
            {'username': 'new-collision', 'name': 'New', 'email': 'legacy@example.test', 'password': self.password},
            {'username': 'employee@example.test', 'name': 'New', 'email': 'different-new@example.test', 'password': self.password},
        ]:
            self.assertEqual(self.client.post('/api/auth/register/', body, **self.csrf()).status_code, 400)
        legacy.refresh_from_db(); self.assertTrue(legacy.is_active); self.assertTrue(legacy.check_password(self.password))
        self.assertFalse(User.objects.filter(username='new-collision').exists())
