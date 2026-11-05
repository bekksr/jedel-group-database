"""Typed textual input; address validation is syntactic, never geocoding."""
from rest_framework import serializers


class StringInputMixin:
    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError('Expected a string.')
        return super().to_internal_value(data)


class StrictTextField(StringInputMixin, serializers.CharField):
    pass


class StrictEmailField(StringInputMixin, serializers.EmailField):
    pass


class OptionalAddressField(StrictTextField):
    def __init__(self, **kwargs):
        super().__init__(required=False, allow_null=True, allow_blank=True, max_length=255, **kwargs)

    def run_validation(self, data=serializers.empty):
        if data is not serializers.empty and data is not None:
            if not isinstance(data, str):
                raise serializers.ValidationError('Address must be a string or null.')
            if data == '':
                data = None  # One canonical representation for an absent address.
            elif not data.strip():
                raise serializers.ValidationError('Address cannot contain only whitespace. Use null or an empty string to clear it.')
        return super().run_validation(data)
