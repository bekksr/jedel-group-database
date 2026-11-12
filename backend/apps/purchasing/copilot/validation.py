from rest_framework import serializers


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError('Supply a JSON object.')
        extra = set(data) - set(self.fields)
        if extra:
            raise serializers.ValidationError({'detail': 'Unsupported fields.'})
        return super().to_internal_value(data)


class SearchInput(StrictSerializer):
    query = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    category = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    match = serializers.ChoiceField(choices=['partial', 'exact'], default='partial')


class InventoryInput(StrictSerializer):
    category = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    threshold = serializers.IntegerField(min_value=0, max_value=2147483647, default=20)
    low_only = serializers.BooleanField(default=True)


class CompareInput(StrictSerializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=1000000)
    csv = serializers.CharField(max_length=65536, allow_blank=True, trim_whitespace=False)
    approved_source = serializers.BooleanField()
    equivalence_confirmed = serializers.BooleanField()
    max_delivery_days = serializers.IntegerField(min_value=0, max_value=3650, required=False, allow_null=True)

    def validate(self, data):
        if not data['approved_source'] or not data['equivalence_confirmed']:
            raise serializers.ValidationError('Confirm source approval and product/specification equivalence before comparison.')
        return data


class DraftInput(StrictSerializer):
    product_id = serializers.IntegerField(min_value=1)
    supplier_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=1000000)


class StatusInput(StrictSerializer):
    order_id = serializers.IntegerField(min_value=1)


class ChatInput(StrictSerializer):
    message = serializers.CharField(max_length=1000)
    consent_to_provider = serializers.BooleanField(default=False)
