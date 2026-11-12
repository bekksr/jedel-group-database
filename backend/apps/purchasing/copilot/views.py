from io import BytesIO
from django.conf import settings
from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, ValidationError
from ..accounts import capabilities
from ..api.parsers import PayloadTooLarge
from . import tools
from .offers import compare_supplier_offers
from .provider import readiness, get_provider, reserve_budget
from .validation import ChatInput
from .orchestration import local_request


class CopilotThrottle(SimpleRateThrottle):
    scope = 'copilot'
    def get_rate(self): return '30/min'
    def get_cache_key(self, request, view):
        identity = 'user:' + str(request.user.pk) if request.user.is_authenticated else 'ip:' + self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': identity}


class ChatThrottle(CopilotThrottle):
    scope = 'copilot-chat'
    def get_rate(self): return f'{settings.AI_CHAT_REQUESTS_PER_MINUTE}/min'


class CopilotParser(JSONParser):
    def parse(self, stream, media_type=None, parser_context=None):
        payload = stream.read(96 * 1024 + 1)
        if len(payload) > 96 * 1024: raise PayloadTooLarge()
        return super().parse(BytesIO(payload), media_type, parser_context)


@method_decorator(csrf_protect, name='dispatch')
class CopilotView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [CopilotThrottle]
    parser_classes = [CopilotParser]


class CapabilitiesView(CopilotView):
    def get(self, request):
        private = request.user.is_authenticated and request.user.is_active
        caps = capabilities(request.user) if private else {}
        return Response({'product_search': True, 'offer_comparison': bool(caps.get('read')), 'inventory': bool(caps.get('read')),
                         'order_draft': bool(caps.get('create_orders')), 'order_status': bool(caps.get('read')),
                         'chat_configured': readiness() == 'configured_unverified', 'chat_requires_login': True,
                         'chat_status': readiness(),
                         'provider': 'groq',
                         'chat_scope': 'Only your current consented message goes to Groq. Private ERP records and tool results never leave Django. No conversation history is transmitted.',
                         'quotation_storage': 'Request only; nothing is persisted.', 'low_stock_threshold': 20,
                         'threshold_basis': 'Proposed per-request threshold; not stored product reorder levels.'})


class SearchView(CopilotView):
    def post(self, request): return Response(tools.search_products(request.user, **self.arguments(request)))
    @staticmethod
    def arguments(request):
        if not isinstance(request.data, dict): raise ValidationError('Supply a JSON object.')
        return request.data


class InventoryView(SearchView):
    permission_classes = [IsAuthenticated]
    def post(self, request): return Response(tools.get_authorized_inventory(request.user, **self.arguments(request)))


class OffersView(InventoryView):
    def post(self, request): return Response(compare_supplier_offers(request.user, **self.arguments(request)))


class DraftView(InventoryView):
    def post(self, request): return Response(tools.propose_order(request.user, **self.arguments(request)))


class OrderStatusView(InventoryView):
    def post(self, request): return Response(tools.get_authorized_order_status(request.user, **self.arguments(request)))


class SuppliersView(CopilotView):
    permission_classes = [IsAuthenticated]
    def get(self, request): return Response(tools.supplier_options(request.user))


class ChatView(InventoryView):
    throttle_classes = [ChatThrottle]
    def post(self, request):
        data = tools.validated(ChatInput, self.arguments(request))
        local = local_request(request.user, data['message'])
        if local is not None: return Response(local)
        if not data['consent_to_provider']:
            raise PermissionDenied('Confirm consent to send this message to the configured AI provider. Do not include confidential information.')
        provider = get_provider()
        reserve_budget(request.user.pk)
        # One cloud request, at most one local tool. Never send tool results back.
        plan = provider.interpret(data['message'])
        tool = plan.get('tool')
        if tool == 'conversation':
            return Response({'kind': 'conversation', 'message': plan['message'], 'source': 'Groq general conversation; not PostgreSQL facts'})
        if tool == 'inventory':
            return Response({'kind': 'inventory', 'inventory': tools.get_authorized_inventory(request.user, **plan['arguments']), 'message': 'Source: PostgreSQL inventory. Groq interpreted the question; database results remain local.'})
        if tool == 'order_status':
            return Response({'kind': 'order_status', 'order_status': tools.get_authorized_order_status(request.user, **plan['arguments']), 'message': 'Source: PostgreSQL purchase orders. Read only; results remain local.'})
        if tool == 'draft':
            return Response({'kind': 'draft', 'draft': tools.propose_order(request.user, **plan['arguments']), 'message': 'Review-only local draft. Nothing was saved or sent to Groq.'})
        if tool == 'compare_quotations':
            tools.require(request.user)
            return Response({'kind': 'guidance', 'message': 'Select a product and use Best offer finder with approved quotation CSV and confirmed equivalent specifications. Comparison uses Decimal locally; quotations are never sent to Groq.', 'source': 'Local comparison guidance'})
        result = tools.search_products(request.user, **plan)
        return Response({'kind': 'ai_interpreted_catalog_search', 'message': f"Found {len(result['results'])} matching catalog records. Results below come from PostgreSQL; the model only interpreted the search filters.", **result})
