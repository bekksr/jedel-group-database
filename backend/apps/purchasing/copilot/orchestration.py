"""Small, deterministic private intents; private ERP context never goes to an LLM."""
import re
from rest_framework.exceptions import ValidationError
from . import tools


def local_request(user, message):
    text = message.strip().rstrip('.?!').strip()
    if re.fullmatch(r'(which products have low stock|what items should we consider purchasing|show low stock)', text, re.I):
        inventory = tools.get_authorized_inventory(user)
        return {'kind': 'inventory', 'inventory': inventory, 'message': 'Inventory read from PostgreSQL using the proposed threshold 20. No forecast or purchase was created.'}
    category = re.fullmatch(r'show inventory levels for category (.{1,50})', text, re.I)
    if category:
        inventory = tools.get_authorized_inventory(user, category=category.group(1), low_only=False)
        return {'kind': 'inventory', 'inventory': inventory, 'message': 'Category inventory read from PostgreSQL. No provider was contacted.'}
    draft = re.fullmatch(r'(?:help me )?prepare a purchase order for (\d{1,7}) units of product #?(\d{1,10}) from supplier #?(\d{1,10})', text, re.I)
    if draft:
        result = tools.propose_order(user, quantity=int(draft.group(1)), product_id=int(draft.group(2)), supplier_id=int(draft.group(3)))
        return {'kind': 'draft', 'draft': result, 'message': 'Review-only purchase order proposal. Nothing was saved or sent to an external provider.'}
    status = re.fullmatch(r'show purchase order #?(\d{1,10}) status', text, re.I)
    if status:
        result = tools.get_authorized_order_status(user, order_id=int(status.group(1)))
        return {'kind': 'order_status', 'order_status': result, 'message': 'Current order status read from PostgreSQL. No provider was contacted.'}
    # Do not forward attempted private procurement instructions to a public-search model.
    if re.search(r'\b(supplier|suppliers|order|orders|stock|inventory|price|prices|cost|costs|approve|deliver|cancel)\b', text, re.I):
        raise ValidationError('Use the authorized structured tools for private purchasing data. This message was not sent to an AI provider.')
    return None
