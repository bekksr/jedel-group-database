import os
import re
from pathlib import Path
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def attach_constraints(apps, schema_editor):
    connection = schema_editor.connection
    if os.getenv('JEDEL_ISOLATED_TESTS') == '1':
        from config.test_runner import assert_isolated
        assert_isolated(connection)
        with connection.cursor() as cursor:
            tables = set(connection.introspection.table_names(cursor))
            if 'purchase_orders' not in tables:
                dump = (Path(settings.BASE_DIR).parent / 'database/dumps/jedel_group_db.sql').read_text(encoding='utf-8')
                patterns = [r'CREATE TABLE public\.[a-z_]+ \(.*?;', r'ALTER TABLE public\.[a-z_]+ ALTER COLUMN.*?;', r'ALTER TABLE ONLY public\.[a-z_]+.*?;']
                statements = [(m.start(), m.group()) for pattern in patterns for m in re.finditer(pattern, dump, re.S)]
                if len(statements) != 17:
                    raise RuntimeError('Unexpected isolated test schema.')
                for _, statement in sorted(statements):
                    cursor.execute(statement)
    elif os.getenv('JEDEL_ISOLATED_DEVELOPMENT') != '1' or connection.settings_dict['NAME'] != 'jedel_dev':
        raise RuntimeError('Demo identity migration requires isolated jedel_dev.')
    with connection.cursor() as cursor:
        cursor.execute('ALTER TABLE demo_identity_demoorderbinding ADD CONSTRAINT demo_order_binding_order_fk FOREIGN KEY (order_id) REFERENCES purchase_orders(order_id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED')
        cursor.execute('ALTER TABLE demo_identity_demoitembinding ADD CONSTRAINT demo_item_binding_item_fk FOREIGN KEY (item_id) REFERENCES purchase_order_items(item_id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED')


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(name='DemoOrderBinding', fields=[('key', models.CharField(max_length=100, primary_key=True, serialize=False)), ('order_id', models.IntegerField(null=True, unique=True)), ('reviewed_missing', models.BooleanField(default=False))], options={'constraints': [models.CheckConstraint(condition=models.Q(('reviewed_missing', False), ('order_id__isnull', True), _connector='OR'), name='demo_reviewed_missing_unbound')]}),
        migrations.CreateModel(name='DemoItemBinding', fields=[('key', models.CharField(max_length=100, primary_key=True, serialize=False)), ('item_id', models.IntegerField(null=True, unique=True)), ('order_binding', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='demo_identity.demoorderbinding'))]),
        migrations.RunPython(attach_constraints, migrations.RunPython.noop),
    ]
