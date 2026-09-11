from django.apps import AppConfig


class KrishiCoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'krishi_core'

    def ready(self):
        from . import ml_loader
        ml_loader.load_everything()
        import os
        from django.conf import settings
        # Only run jobs if scheduler is explicitly enabled and running in main server process
        if not getattr(settings, 'ENABLE_SCHEDULER', False):
            return
        if os.environ.get('RUN_MAIN', None) != 'true':
            return
        from .jobs import start_jobs
        start_jobs()
