from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .api.serializers import StrictInputMixin

class RegistrationSerializer(StrictInputMixin, serializers.Serializer):
    name = serializers.CharField(max_length=100)
    email = serializers.EmailField(max_length=150)
    username = serializers.CharField(max_length=150, required=False)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)
    password_confirm = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True, required=False)

    def validate(self, attrs):
        if 'password_confirm' in attrs and attrs.pop('password_confirm') != attrs['password']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        attrs['email'] = attrs['email'].lower()
        attrs.setdefault('username', attrs['email'])
        user = User(username=attrs['username'], email=attrs['email'], first_name=attrs['name'], is_active=False)
        try:
            User._meta.get_field('username').run_validators(user.username)
        except DjangoValidationError as error:
            raise serializers.ValidationError({'username': error.messages}) from None
        try:
            validate_password(attrs['password'], user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({'password': error.messages}) from None
        return attrs

class LoginSerializer(StrictInputMixin, serializers.Serializer):
    identifier = serializers.CharField(max_length=254, required=False)
    username = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(max_length=254, required=False)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        identifiers = [attrs[key] for key in ('identifier', 'username', 'email') if key in attrs]
        if len(identifiers) != 1:
            raise serializers.ValidationError({'identifier': 'Provide one email address or existing username.'})
        return {'identifier': identifiers[0], 'password': attrs['password']}
