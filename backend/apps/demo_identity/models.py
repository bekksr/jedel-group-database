from django.db import models


class DemoOrderBinding(models.Model):
    key = models.CharField(max_length=100, primary_key=True)
    order_id = models.IntegerField(null=True, unique=True)
    reviewed_missing = models.BooleanField(default=False)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(reviewed_missing=False) | models.Q(order_id__isnull=True), name='demo_reviewed_missing_unbound')]


class DemoItemBinding(models.Model):
    key = models.CharField(max_length=100, primary_key=True)
    order_binding = models.ForeignKey(DemoOrderBinding, on_delete=models.PROTECT)
    item_id = models.IntegerField(null=True, unique=True)
