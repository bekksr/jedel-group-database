"""Read-only constraint/trigger inspection; no row contents or secrets emitted."""
import json
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from .verify_connection import Command as VerifyConnection, TABLES


class Command(BaseCommand):
    help = 'Read actual business constraints, nullability, triggers, and quality counts without writes.'

    def handle(self, *args, **options):
        report = {'connection': VerifyConnection().verify_database()}
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute('SET TRANSACTION READ ONLY')
            cursor.execute("SELECT c.relname, a.attname, a.attnotnull, a.attidentity, format_type(a.atttypid,a.atttypmod) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(%s) AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum", [list(TABLES)])
            report['columns'] = [{'table': t, 'column': col, 'not_null': required, 'identity': identity, 'type': type_} for t, col, required, identity, type_ in cursor.fetchall()]
            cursor.execute("SELECT c.relname, con.conname, con.contype, pg_get_constraintdef(con.oid) FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(%s) ORDER BY c.relname,con.conname", [list(TABLES)])
            report['constraints'] = [{'table': t, 'name': name, 'kind': kind, 'definition': definition} for t, name, kind, definition in cursor.fetchall()]
            cursor.execute("SELECT c.relname, tg.tgname, pg_get_triggerdef(tg.oid) FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(%s) AND NOT tg.tgisinternal ORDER BY c.relname,tg.tgname", [list(TABLES)])
            report['non_internal_triggers'] = [{'table': t, 'name': name, 'definition': definition} for t, name, definition in cursor.fetchall()]
            cursor.execute('SELECT status, COUNT(*) FROM public.purchase_orders GROUP BY status ORDER BY status')
            report['order_status_counts'] = dict(cursor.fetchall())
            cursor.execute("SELECT COUNT(*) FROM public.suppliers WHERE supplier_name IS NULL OR btrim(supplier_name)='' OR email IS NULL OR btrim(email)=''")
            report['missing_or_blank_supplier_identity_count'] = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM (SELECT lower(btrim(email)) FROM public.suppliers GROUP BY lower(btrim(email)) HAVING COUNT(*)>1) duplicates")
            report['case_insensitive_duplicate_email_groups'] = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM public.suppliers WHERE address IS NOT NULL AND address<>'' AND btrim(address)=''")
            report['space_only_address_count'] = cursor.fetchone()[0]
            cursor.execute('SELECT COALESCE(SUM(stock_quantity),0) FROM public.products')
            report['current_stock_units'] = cursor.fetchone()[0]
            transaction.set_rollback(True)
        self.stdout.write(json.dumps(report, indent=2))
