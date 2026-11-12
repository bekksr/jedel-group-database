from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from django.test import SimpleTestCase, override_settings
from django.core.management import call_command, CommandError
from .management.commands.copilot_status import status_report


class CopilotSetupTests(SimpleTestCase):
    def test_smoke_requires_explicit_opt_in_and_never_calls_provider_by_default(self):
        from unittest.mock import patch
        with patch('apps.purchasing.management.commands.copilot_smoke.get_provider') as provider:
            with self.assertRaises(CommandError):
                call_command('copilot_smoke')
            provider.assert_not_called()

    @override_settings(GROQ_API_KEY='test-secret-sentinel', AI_MODEL='openai/gpt-oss-20b', AI_ENABLED=True, AI_PROVIDER='groq')
    def test_status_never_exposes_credentials_or_model_values_or_queries_database(self):
        output = StringIO()
        call_command('copilot_status', stdout=output)
        self.assertNotIn('test-secret-sentinel', output.getvalue())
        self.assertNotIn('private-model-sentinel', output.getvalue())
        self.assertIn('provider availability unverified', output.getvalue())

    @override_settings(GROQ_API_KEY='', AI_MODEL='', AI_ENABLED=False)
    def test_missing_configuration_is_explicit(self):
        result = status_report()
        self.assertFalse(result['provider_configuration_complete'])
        self.assertEqual(result['settings']['GROQ_API_KEY']['status'], 'missing')

    def test_fictional_csv_has_exact_schema_and_refuses_overwrite(self):
        import csv
        from .copilot.offers import COLUMNS
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'fictional.csv'
            call_command('copilot_sample_csv', product_id=1, supplier_id=1, output=str(path), stdout=StringIO())
            with path.open(encoding='utf-8', newline='') as stream:
                reader=csv.DictReader(stream); rows=list(reader)
                self.assertEqual(reader.fieldnames,list(COLUMNS))
            self.assertEqual(len(rows),2)
            self.assertTrue(all('FICTIONAL' in row['source'] for row in rows))
            with self.assertRaises(CommandError):
                call_command('copilot_sample_csv', product_id=1, supplier_id=1, output=str(path), stdout=StringIO())
