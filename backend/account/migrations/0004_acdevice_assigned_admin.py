import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("account", "0003_latesttelemetry"),
    ]

    operations = [
        migrations.AddField(
            model_name="acdevice",
            name="assigned_admin",
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={"role": "BR_ADMIN"},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="allocated_ac_devices",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
