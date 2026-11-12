"""Email-first login with safe compatibility for existing Django usernames."""
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

class EmailOrUsernameBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if not isinstance(username, str) or not isinstance(password, str):
            return None
        identifier = username.strip()
        model = get_user_model()
        # Email is not UNIQUE on Django's existing User. Never select an arbitrary
        # account when legacy emails or email-shaped usernames collide.
        users = list(model._default_manager.filter(Q(username=identifier) | Q(email__iexact=identifier)).distinct()[:2])
        if len(users) != 1:
            model().set_password(password)  # normal password-hashing work on misses
            return None
        user = users[0]
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
