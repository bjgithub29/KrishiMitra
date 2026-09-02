from apscheduler.schedulers.background import BackgroundScheduler
from django_apscheduler.jobstores import DjangoJobStore
from django.conf import settings
from .services.market_sync import sync_daily_market_data
from .services.risk_engine import run_daily_risk_calculation

def start_jobs():
    scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
    scheduler.add_jobstore(DjangoJobStore(), "default")

    scheduler.add_job(
        sync_daily_market_data,
        trigger="cron",
        hour=2,
        minute=0,
        id="sync_daily_market_data",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.add_job(
        run_daily_risk_calculation,
        trigger="cron",
        hour=7,
        minute=0,
        id="run_daily_risk_calculation",
        max_instances=1,
        replace_existing=True,
    )
    
    print("[Jobs] AP Scheduler initialized. Market data sync scheduled for 02:00 AM daily, Risk Engine scheduled for 07:00 AM daily.")
    scheduler.start()
