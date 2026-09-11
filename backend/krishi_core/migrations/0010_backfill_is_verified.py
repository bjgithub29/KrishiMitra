# Generated for KrishiMitra Phase 15.0 - Backfill isVerified for pre-gate users

from django.db import migrations


def backfill_is_verified(apps, schema_editor):
    User = apps.get_model('krishi_core', 'User')
    # User IDs 1 through 8 predate the introduction of the email verification gate.
    # Bounding the backfill to id <= 8 marks all legacy accounts as verified to prevent
    # backwards-incompatible lockouts, while ensuring all accounts created after the
    # verification gate (id >= 9) must complete standard OTP verification before login.
    User.objects.filter(id__lte=8).update(isVerified=True)


def reverse_backfill(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('krishi_core', '0009_authotp_purpose'),
    ]

    operations = [
        migrations.RunPython(backfill_is_verified, reverse_backfill),
    ]
