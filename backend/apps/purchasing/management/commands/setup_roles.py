from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import Group, Permission
from django.db import transaction
from apps.purchasing.accounts import ROLES


def intended_permissions(role):
    caps = ROLES[role]
    names = set()
    if 'read' in caps:
        names.update('purchasing.view_' + model for model in ('supplier', 'product', 'purchaseorder', 'purchaseorderitem'))
    if 'manage_catalog' in caps:
        names.update('purchasing.' + action + '_' + model for action in ('add', 'change') for model in ('supplier', 'product'))
    if 'create_orders' in caps:
        names.update({'purchasing.add_purchaseorder', 'purchasing.change_purchaseorder'})
    if 'delete_records' in caps:
        names.update('purchasing.delete_' + model for model in ('supplier', 'product', 'purchaseorder'))
    if role == 'System Administrator':
        names.update('auth.' + action + '_' + model for action in ('view', 'add', 'change', 'delete') for model in ('user', 'group', 'permission'))
    return names


class Command(BaseCommand):
    help = 'Plan or explicitly confirm additive role grants; never changes users.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--confirm', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['confirm'] and options['dry_run']:
            raise CommandError('Choose --dry-run or --confirm, not both.')
        permissions = {p.content_type.app_label + '.' + p.codename: p for p in Permission.objects.select_related('content_type')}
        plans, conflicts = [], []
        for name in ROLES:
            expected = intended_permissions(name)
            missing = expected - permissions.keys()
            if missing:
                raise CommandError('Required Django permissions missing: ' + ', '.join(sorted(missing)))
            group = Group.objects.select_for_update().filter(name=name).first()
            existing = set() if group is None else {p.content_type.app_label + '.' + p.codename for p in group.permissions.select_related('content_type')}
            if existing - expected:
                conflicts.append(name + ': ' + ', '.join(sorted(existing - expected)))
            self.stdout.write(f'{name}: {"create" if group is None else "reuse"}; add {", ".join(sorted(expected - existing)) or "nothing"}')
            plans.append((name, expected - existing))
        if conflicts:
            raise CommandError('Unexpected grants require review; nothing changed. ' + '; '.join(conflicts))
        if not options['confirm']:
            self.stdout.write('DRY RUN: no writes. Review then explicitly use --confirm.')
            return
        for name, additions in plans:
            group, _ = Group.objects.get_or_create(name=name)
            group.permissions.add(*(permissions[key] for key in additions))
        self.stdout.write('Six roles ready. User assignments, passwords and staff/superuser flags unchanged.')
