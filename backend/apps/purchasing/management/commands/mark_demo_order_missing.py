"""Record an operator-reviewed absent legacy fixture without guessing."""
import os
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from .seed_demo import ORDER_FIXTURES, BASE_ORDER_KEYS


class Command(BaseCommand):
    help = 'Preview or record that a legacy demo order was reviewed and is absent.'

    def add_arguments(self, parser):
        parser.add_argument('--key', required=True)
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--confirm-reviewed-absent', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if os.getenv('JEDEL_ISOLATED_DEVELOPMENT') != '1' or connection.settings_dict['NAME'] != 'jedel_dev':
            raise CommandError('Requires explicitly isolated jedel_dev; no changes made.')
        if options['apply'] and not options['confirm_reviewed_absent']:
            raise CommandError('Explicit --confirm-reviewed-absent is required after inspecting local orders.')
        from apps.demo_identity.models import DemoOrderBinding
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(%s)', [74832911])
        fixture = next((f for f in ORDER_FIXTURES if f['key'] == options['key']), None)
        if fixture is None or fixture['key'] not in BASE_ORDER_KEYS:
            raise CommandError('Only an original legacy fixture key can be marked reviewed absent.')
        if DemoOrderBinding.objects.filter(key=fixture['key']).exists():
            raise CommandError('Identity already exists, including any tombstone; it will not be replaced.')
        self.stdout.write(f"Operator review required: {fixture['key']}, supplier {fixture['supplier']}, status {fixture['status']}, items {', '.join(fixture['products'])}. No identity matching was attempted.")
        if options['apply']:
            DemoOrderBinding.objects.create(key=fixture['key'], reviewed_missing=True)
            self.stdout.write('Reviewed absence recorded; sync remains preview-only until explicitly applied.')
        else:
            self.stdout.write('Preview only. Inspect local orders, then use --apply --confirm-reviewed-absent if genuinely absent.')
