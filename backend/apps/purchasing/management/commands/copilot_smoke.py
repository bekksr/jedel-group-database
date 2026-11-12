"""Explicit operator opt-in only; never called by startup or status checks."""
from django.core.management.base import BaseCommand, CommandError
from django.test import override_settings
from apps.purchasing.copilot.provider import get_provider, reserve_budget, ProviderUnavailable


class Command(BaseCommand):
    help = 'One optional Groq request, no database data. Requires separate approval.'

    def add_arguments(self, parser):
        parser.add_argument('--confirm-external-request', action='store_true')

    def handle(self, *args, **options):
        if not options['confirm_external_request']:
            raise CommandError('No request sent. Obtain approval, then use --confirm-external-request.')
        try:
            provider = get_provider()
            reserve_budget('operator-smoke')
            with override_settings(AI_MAX_OUTPUT_TOKENS=64):
                result = provider.interpret('Say hello in one short sentence. Do not use tools.')
            if result.get('tool') != 'conversation':
                raise CommandError('Groq responded, but the smoke response was not a short greeting.')
            self.stdout.write('Groq connectivity verified: ' + result['message'][:300])
        except ProviderUnavailable as error:
            raise CommandError(str(error.detail)) from None
