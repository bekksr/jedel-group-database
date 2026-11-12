import logging
from django.db import DatabaseError, IntegrityError
from django.core.exceptions import RequestDataTooBig
from django.db.models.deletion import ProtectedError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response
    if isinstance(exc, RequestDataTooBig):
        return Response({'detail': 'Request exceeds the maximum allowed size.'}, status=413)
    if isinstance(exc, ProtectedError):
        return Response({'detail': 'This record is referenced by purchase orders and cannot be deleted.'}, status=409)
    if isinstance(exc, IntegrityError):
        cause = exc.__cause__
        code = getattr(cause, 'pgcode', None)
        diag = getattr(cause, 'diag', None)
        name = getattr(diag, 'constraint_name', None)
        request = context.get('request')
        # Map known PostgreSQL integrity failures to safe API validation errors.
        # Referenced deletion/status conflicts retain HTTP 409.
        if getattr(request, 'method', None) != 'DELETE' and code in {'23502', '23503', '23505', '23514'}:
            known = {
                'suppliers_email_key': ('email', 'A supplier with this email already exists.'),
                'uq_order_product': ('items', 'A product cannot appear twice in one order.'),
                'products_unit_price_check': ('unit_price', 'Unit price cannot be negative.'),
                'products_stock_quantity_check': ('stock_quantity', 'Stock quantity cannot be negative.'),
                'purchase_order_items_quantity_check': ('items', 'Order item quantity must be greater than zero.'),
                'purchase_order_items_unit_price_check': ('items', 'Order item price cannot be negative.'),
                'chk_delivery_date': ('expected_delivery_date', 'Expected delivery cannot precede order date.'),
                'fk_purchase_order_supplier': ('supplier_id', 'Select an existing supplier.'),
                'fk_item_product': ('items', 'Every item must reference an existing product.'),
            }
            field, message = known.get(name, ('detail', 'Data violates a required value, relationship, uniqueness, or check constraint.'))
            return Response({field: [message]}, status=400)
        return Response({'detail': 'The operation violates a uniqueness, relationship, or data constraint.'}, status=409)
    if isinstance(exc, DatabaseError):
        request = context.get('request')
        if getattr(request, 'path', '').startswith('/api/auth/') and getattr(exc.__cause__, 'pgcode', None) == '42P01':
            return Response({'detail': 'Account service setup is incomplete. Contact the administrator; account registration and login are not available yet.', 'code': 'authentication_setup_required'}, status=503)
        logger.error('Database operation failed in %s', type(context.get('view')).__name__)
        return Response({'detail': 'Database service is unavailable. Check resource state before retrying.'}, status=503)
    logger.error('Unexpected API failure in %s', type(context.get('view')).__name__)
    return Response({'detail': 'An unexpected server error occurred.'}, status=500)
