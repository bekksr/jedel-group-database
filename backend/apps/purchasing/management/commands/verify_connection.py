"""Read-only SQL and authenticated HTTP diagnostics. Never print credentials."""
import json
import secrets
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction, DatabaseError
from apps.purchasing.postgres_diagnostics import psql_read_only, diagnosis_message

TABLES = {
    'suppliers': {'supplier_id', 'supplier_name', 'email', 'phone', 'address'},
    'products': {'product_id', 'product_name', 'category', 'unit_price', 'stock_quantity'},
    'purchase_orders': {'order_id', 'supplier_id', 'order_date', 'status', 'expected_delivery_date'},
    'purchase_order_items': {'item_id', 'order_id', 'product_id', 'quantity', 'unit_price'},
}
ROLES = {'viewer': 'ERP_READ_TOKEN', 'buyer': 'ERP_BUYER_TOKEN', 'approver': 'ERP_APPROVER_TOKEN', 'admin': 'ERP_WRITE_TOKEN'}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Command(BaseCommand):
    help = 'Verify the existing database with READ ONLY SQL and authenticated local GETs.'

    def add_arguments(self, parser):
        group = parser.add_mutually_exclusive_group()
        group.add_argument('--database-only', action='store_true')
        group.add_argument('--http-only', action='store_true')
        group.add_argument('--psql-only', action='store_true', help='Independent authenticated read-only psql query; credentials stay in the child environment.')
        parser.add_argument('--role', choices=ROLES, default='viewer')
        parser.add_argument('--api-base-url', default='http://127.0.0.1:8000/api')
        parser.add_argument('--proxy-base-url', default='http://localhost:4200/api')

    def verify_database(self):
        if not settings.DATABASES['default']['USER'] or not settings.DATABASES['default']['PASSWORD']:
            raise CommandError('DB_USER and DB_PASSWORD are required. Enter the existing database credentials through scripts/start-development.ps1; never paste them into chat.')
        try:
            with transaction.atomic(), connection.cursor() as cursor:
                cursor.execute('SET TRANSACTION READ ONLY')
                cursor.execute('SHOW transaction_read_only')
                if cursor.fetchone()[0] != 'on':
                    raise CommandError('Read-only verification could not be enforced.')
                cursor.execute('SELECT current_database()')
                database = cursor.fetchone()[0]
                if database != settings.DATABASES['default']['NAME']:
                    raise CommandError('The connected database does not match DB_NAME.')
                counts = {}
                for table, expected in TABLES.items():
                    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s", [table])
                    columns = {row[0] for row in cursor.fetchall()}
                    if not expected.issubset(columns):
                        raise CommandError(f'Missing table/columns in {table}. No schema changes were attempted.')
                    cursor.execute('SELECT COUNT(*) FROM public.' + connection.ops.quote_name(table))
                    counts[table] = cursor.fetchone()[0]
                transaction.set_rollback(True)
        except UnicodeDecodeError:
            result = psql_read_only(settings.DATABASES['default'])
            raise CommandError('psycopg2 could not decode a localized libpq connection error as UTF-8. This does not imply Unicode in the password. ' + diagnosis_message(result)) from None
        except DatabaseError:
            raise CommandError('PostgreSQL read-only verification failed. Check the existing role, password, host, port, database name, and SELECT privileges. No migrations or writes were attempted.') from None
        return {'database': database, 'transaction_read_only': True, 'table_counts': counts}

    def verify_http(self, base, token, role):
        parsed = urlsplit(base)
        if parsed.scheme not in {'http', 'https'} or parsed.hostname not in {'localhost', '127.0.0.1', '::1'} or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise CommandError('Credential checks accept local loopback API URLs only, without URL credentials or query strings.')
        opener = build_opener(NoRedirect())
        def get(path, credential, expected=200):
            headers = {'Accept': 'application/json'}
            if credential:
                headers['Authorization'] = 'Bearer ' + credential
            request = Request(base.rstrip('/') + '/' + path, headers=headers, method='GET')
            try:
                with opener.open(request, timeout=8) as response:
                    status = response.status
                    body = json.loads(response.read())
            except HTTPError as error:
                status = error.code
                body = None
            except (URLError, OSError, ValueError):
                raise CommandError('Cannot read API response at ' + base + '. Check the running server and Angular proxy; credential values were not logged.') from None
            if status != expected:
                raise CommandError(f'GET {path} via {base} returned {status}, expected {expected}. 401 means token not accepted; 403 means insufficient role; 503 means database unavailable. No token or response records were logged.')
            return body
        get('access/', None, 401)
        get('access/', secrets.token_urlsafe(48), 401)
        access = get('access/', token)
        if access.get('role') != role:
            raise CommandError('The server accepted a different credential role than expected. Restart Django with the same environment.')
        checks = {'access/': 200}
        for path in ['dashboard/', 'suppliers/', 'products/', 'orders/', 'analytics/supplier-spending/', 'analytics/order-status/']:
            get(path, token)
            checks[path] = 200
        return {'base_url': base, 'authenticated_role': role, 'anonymous_status': 401, 'invalid_token_status': 401, 'authenticated_gets': checks}

    def handle(self, *args, **options):
        result = {}
        if options.get('psql_only'):
            config = settings.DATABASES['default']
            if not config['USER'] or not config['PASSWORD']:
                raise CommandError('DB_USER and DB_PASSWORD are required for independent psql verification.')
            result['psql'] = psql_read_only(config)
            if result['psql']['status'] != 'authenticated_read_only_query_succeeded':
                raise CommandError(diagnosis_message(result['psql']))
            self.stdout.write(json.dumps(result, indent=2))
            return
        if not options['http_only']:
            result['sql'] = self.verify_database()
        if not options['database_only']:
            role = options['role']
            token = getattr(settings, ROLES[role], '')
            if not token:
                raise CommandError('Selected role token is not configured in this backend process environment.')
            result['http'] = [self.verify_http(base, token, role) for base in [options['api_base_url'], options['proxy_base_url']]]
        self.stdout.write(json.dumps(result, indent=2))
