from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

def authorized(user):
    return user.is_active and (user.is_superuser or user.groups.filter(name__in=['Security Administrator', 'System Administrator']).exists())

def delegated_users():
    return User.objects.filter(is_staff=False, is_superuser=False, user_permissions__isnull=True, groups__name__in=['Basic User', 'Purchasing Employee', 'Analyst / Tester']).exclude(groups__name__in=['System Administrator', 'Purchasing Manager', 'Security Administrator']).distinct()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def accounts(request):
    if not authorized(request.user):
        return Response({'detail': 'Security administration permission required.'}, status=403)
    return Response({'results': [{'id': user.pk, 'username': user.username, 'is_active': user.is_active} for user in delegated_users().exclude(pk=request.user.pk)]})

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def activation(request, pk):
    if not authorized(request.user):
        return Response({'detail': 'Security administration permission required.'}, status=403)
    if set(request.data) != {'is_active'} or type(request.data['is_active']) is not bool:
        return Response({'detail': 'Supply only a boolean is_active.'}, status=400)
    with transaction.atomic():
        # Lock the user before rechecking delegated eligibility.
        user = User.objects.select_for_update().filter(pk=pk).first()
        if user is None or pk == request.user.pk or not delegated_users().filter(pk=pk).exists():
            return Response({'detail': 'This account requires trusted superuser administration.'}, status=403)
        user.is_active = request.data['is_active']
        user.save(update_fields=['is_active'])
    return Response({'id': user.pk, 'username': user.username, 'is_active': user.is_active})
