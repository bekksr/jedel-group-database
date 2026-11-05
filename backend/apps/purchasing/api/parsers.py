from io import BytesIO
from django.conf import settings
from rest_framework.exceptions import APIException
from rest_framework.parsers import JSONParser


class PayloadTooLarge(APIException):
    status_code = 413
    default_detail = 'JSON request exceeds the maximum allowed size.'
    default_code = 'payload_too_large'


class LimitedJSONParser(JSONParser):
    """Bound actual bytes, including requests without a trusted Content-Length."""
    def parse(self, stream, media_type=None, parser_context=None):
        limit = settings.DATA_UPLOAD_MAX_MEMORY_SIZE
        payload = stream.read(limit + 1)
        if len(payload) > limit:
            raise PayloadTooLarge()
        return super().parse(BytesIO(payload), media_type, parser_context)
