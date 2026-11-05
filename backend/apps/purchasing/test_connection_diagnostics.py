from io import BytesIO
import json
from unittest.mock import patch
from urllib.error import HTTPError
from django.conf import settings
from django.core.management.base import CommandError
from django.db import connection
from django.test import SimpleTestCase, TransactionTestCase
from config.test_runner import assert_isolated
from .tests import FixtureMixin
from .management.commands.verify_connection import Command


class LocalHTTPDiagnosticTests(SimpleTestCase):
    def test_local_http_verification_checks_anonymous_invalid_and_valid_credentials(self):
        token = 'test-only-value-not-a-real-credential'
        class Response(BytesIO):
            status = 200
        def request(req, timeout):
            auth = req.get_header('Authorization')
            if auth != 'Bearer ' + token:
                raise HTTPError(req.full_url, 401, 'Unauthorized', {}, None)
            body = {'role': 'viewer'} if req.full_url.endswith('/access/') else {}
            return Response(json.dumps(body).encode())
        with patch('apps.purchasing.management.commands.verify_connection.build_opener') as opener:
            opener.return_value.open.side_effect = request
            result = Command().verify_http('http://localhost:4200/api', token, 'viewer')
        self.assertEqual(result['anonymous_status'], 401)
        self.assertEqual(result['invalid_token_status'], 401)
        self.assertEqual(len(result['authenticated_gets']), 7)
        self.assertNotIn(token, json.dumps(result))

    def test_credentials_are_never_sent_to_nonlocal_or_url_credential_targets(self):
        for url in ['https://external.example/api', 'http://user:secret@localhost/api', 'file:///api', 'http://localhost/api?token=unsafe']:
            with self.subTest(url=url), patch('apps.purchasing.management.commands.verify_connection.build_opener') as opener:
                with self.assertRaises(CommandError):
                    Command().verify_http(url, 'test-only-value', 'viewer')
                opener.assert_not_called()

    def test_redirect_and_api_failure_are_not_reported_as_success(self):
        def request(req, timeout):
            # Anonymous and invalid-token checks are expected to reject.
            if req.get_header('Authorization') != 'Bearer test-only-value':
                raise HTTPError(req.full_url, 401, 'Unauthorized', {}, None)
            raise HTTPError(req.full_url, 302, 'Redirect', {}, None)
        with patch('apps.purchasing.management.commands.verify_connection.build_opener') as opener:
            opener.return_value.open.side_effect = request
            with self.assertRaisesMessage(CommandError, 'returned 302'):
                Command().verify_http('http://127.0.0.1:8000/api', 'test-only-value', 'viewer')

    def test_missing_credentials_fail_before_database_access(self):
        with patch.dict(settings.DATABASES['default'], {'USER': '', 'PASSWORD': ''}):
            with self.assertRaisesMessage(CommandError, 'DB_USER and DB_PASSWORD'):
                Command().verify_database()


class SQLDiagnosticTests(FixtureMixin, TransactionTestCase):
    def clear(self):
        assert_isolated(connection)
        if connection.settings_dict['NAME'] != 'test_jedel_api':
            raise AssertionError('Unexpected test database.')
        with connection.cursor() as cursor:
            cursor.execute('TRUNCATE purchase_order_items, purchase_orders, products, suppliers RESTART IDENTITY')

    def setUp(self):
        self.clear(); self.seed()

    def tearDown(self):
        self.clear()

    def test_four_tables_verified_with_read_only_transaction_and_no_record_changes(self):
        report = Command().verify_database()
        self.assertTrue(report['transaction_read_only'])
        self.assertEqual(report['table_counts'], {'suppliers': 1, 'products': 2, 'purchase_orders': 0, 'purchase_order_items': 0})
        self.assertEqual(Command().verify_database()['table_counts'], report['table_counts'])


    def test_independent_psql_authenticates_and_runs_a_read_only_query(self):
        from .postgres_diagnostics import psql_read_only
        result = psql_read_only(settings.DATABASES['default'])
        self.assertEqual(result['status'], 'authenticated_read_only_query_succeeded')
        self.assertTrue(result['transaction_read_only'])
        self.assertEqual(result['database'], 'test_jedel_api')


class EncodingDiagnosticTests(SimpleTestCase):
    def config(self):
        return {'HOST': '127.0.0.1', 'PORT': '5432', 'NAME': 'jedel_group_db', 'USER': 'postgres', 'PASSWORD': 'synthetic-test-value-only', 'OPTIONS': {'sslmode': 'prefer'}}

    def test_cp1251_authentication_message_is_classified_without_returning_raw_text(self):
        from .postgres_diagnostics import classify_error, diagnosis_message
        message = '\u0412\u0410\u0416\u041d\u041e: \u043f\u0430\u0440\u043e\u043b\u044c \u043d\u0435\u0432\u0435\u0440\u0435\u043d'
        result = {'status': classify_error(message.encode('cp1251'))}
        self.assertEqual(result['status'], 'authentication_rejected')
        self.assertNotIn(message, diagnosis_message(result))

    def test_psql_receives_password_only_in_environment_and_uses_fixed_read_only_sql(self):
        from subprocess import CompletedProcess
        from .postgres_diagnostics import psql_read_only
        config = self.config()
        with patch('apps.purchasing.postgres_diagnostics.find_psql', return_value='psql.exe'), patch('apps.purchasing.postgres_diagnostics.subprocess.run') as run:
            run.return_value = CompletedProcess([], 0, stdout=b'jedel_group_db\ton\n', stderr=b'')
            result = psql_read_only(config)
        args = run.call_args.args[0]
        self.assertNotIn(config['PASSWORD'], ' '.join(args))
        self.assertEqual(run.call_args.kwargs['env']['PGPASSWORD'], config['PASSWORD'])
        self.assertIn('BEGIN READ ONLY;', args[-1])
        self.assertIn('ROLLBACK;', args[-1])
        self.assertIn('-w', args)
        self.assertEqual(result['status'], 'authenticated_read_only_query_succeeded')

    def test_psql_rejection_is_not_reported_as_connected(self):
        from subprocess import CompletedProcess
        from .postgres_diagnostics import psql_read_only
        with patch('apps.purchasing.postgres_diagnostics.find_psql', return_value='psql.exe'), patch('apps.purchasing.postgres_diagnostics.subprocess.run') as run:
            run.return_value = CompletedProcess([], 2, stdout=b'', stderr=b'password authentication failed for user postgres')
            result = psql_read_only(self.config())
        self.assertEqual(result, {'status': 'authentication_rejected'})
        self.assertNotIn(self.config()['PASSWORD'], json.dumps(result))

    def test_psql_unavailable_does_not_print_subprocess_errors_or_claim_success(self):
        from .postgres_diagnostics import psql_read_only
        with patch('apps.purchasing.postgres_diagnostics.find_psql', return_value=None):
            self.assertEqual(psql_read_only(self.config()), {'status': 'psql_unavailable'})

    def test_unicode_connect_error_becomes_safe_actionable_command_error(self):
        error = UnicodeDecodeError('utf-8', bytes([0xc2]), 0, 1, 'invalid continuation byte')
        with patch.dict(settings.DATABASES['default'], self.config()), patch('apps.purchasing.management.commands.verify_connection.transaction.atomic', side_effect=error), patch('apps.purchasing.management.commands.verify_connection.psql_read_only', return_value={'status': 'authentication_rejected'}):
            with self.assertRaisesMessage(CommandError, 'psql independently confirms') as context:
                Command().verify_database()
        self.assertIn('does not imply Unicode in the password', str(context.exception))
        self.assertNotIn(self.config()['PASSWORD'], str(context.exception))

    def test_psql_success_after_driver_error_is_not_misdiagnosed_as_bad_password(self):
        from .postgres_diagnostics import diagnosis_message
        message = diagnosis_message({'status': 'authenticated_read_only_query_succeeded'})
        self.assertIn('not evidence of a bad password', message)
