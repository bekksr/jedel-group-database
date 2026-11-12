from io import StringIO
from django.test import TestCase, RequestFactory
from django.core.management import call_command, CommandError
from django.contrib.auth.models import User, Group, Permission
from django.contrib import admin
from .accounts import capabilities, profile, ROLES

class RoleProvisioningTests(TestCase):
    def test_dry_run_idempotence_and_preservation(self):
        user = User.objects.create_user('preserved', password='Original-password-123!')
        original = user.password
        call_command('setup_roles', dry_run=True, stdout=StringIO())
        self.assertFalse(Group.objects.exists())
        call_command('setup_roles', confirm=True, stdout=StringIO())
        before = list(Group.objects.order_by('name').values_list('name', 'permissions__id'))
        call_command('setup_roles', confirm=True, stdout=StringIO())
        self.assertEqual(before, list(Group.objects.order_by('name').values_list('name', 'permissions__id')))
        self.assertEqual(set(Group.objects.values_list('name', flat=True)), set(ROLES))
        user.refresh_from_db()
        self.assertEqual(user.password, original)
        self.assertFalse(user.is_staff or user.is_superuser or user.groups.exists())

    def test_conflicts_abort_without_deleting_grants(self):
        group = Group.objects.create(name='Basic User')
        group.permissions.add(Permission.objects.get(codename='change_user'))
        with self.assertRaises(CommandError):
            call_command('setup_roles', confirm=True, stdout=StringIO())
        self.assertEqual(Group.objects.count(), 1)
        self.assertEqual(group.permissions.count(), 1)

    def test_group_union_and_disabled_account(self):
        call_command('setup_roles', confirm=True, stdout=StringIO())
        user = User.objects.create_user('combined')
        user.groups.add(*Group.objects.filter(name__in=['Basic User', 'Purchasing Employee', 'Analyst / Tester']))
        self.assertTrue(capabilities(user)['create_orders'])
        self.assertFalse(capabilities(user)['transition_orders'])
        self.assertFalse(profile(user)['can_administer'])
        user.is_active = False
        self.assertFalse(any(capabilities(user).values()))

    def test_raw_auth_grants_do_not_authorize_security_staff(self):
        call_command('setup_roles', confirm=True, stdout=StringIO())
        user = User.objects.create_user('delegated', is_staff=True)
        user.groups.add(Group.objects.get(name='Security Administrator'))
        user.user_permissions.add(*Permission.objects.filter(content_type__app_label='auth'))
        request = RequestFactory().get('/admin/')
        request.user = user
        self.assertFalse(admin.site._registry[User].has_change_permission(request))
        self.assertFalse(admin.site._registry[Group].has_change_permission(request))
        self.assertFalse(profile(user)['can_administer'])

    def test_system_admin_cannot_edit_superuser_flag_or_own_role(self):
        call_command('setup_roles', confirm=True, stdout=StringIO())
        user = User.objects.create_user('system', is_staff=True)
        user.groups.add(Group.objects.get(name='System Administrator'))
        request = RequestFactory().get('/admin/')
        request.user = user
        model_admin = admin.site._registry[User]
        self.assertTrue(model_admin.has_change_permission(request))
        fields = model_admin.get_readonly_fields(request, user)
        self.assertIn('is_superuser', fields)
        self.assertIn('groups', fields)
        self.assertFalse(user.is_superuser)
        root = User.objects.create_superuser('root', password='Isolated-root-password-123!')
        self.assertFalse(model_admin.has_change_permission(request, root))
        self.assertFalse(model_admin.has_delete_permission(request, root))
        self.assertFalse(model_admin.get_queryset(request).filter(pk=root.pk).exists())
