import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jobpilot.settings")

app = Celery("jobpilot")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# ── Periodic tasks (fallback if Beat DB not ready) ──
app.conf.beat_schedule = {
    # Scrape all portals every 4 hours
    "scrape-all-portals": {
        "task": "apps.scraper.tasks.scrape_all_portals",
        "schedule": 14400.0,   # seconds
        "options": {"queue": "scraping"},
    },
    # Re-score all pending applications with AI every hour
    "rescore-applications": {
        "task": "apps.ai.tasks.rescore_pending_applications",
        "schedule": 3600.0,
        "options": {"queue": "ai_scoring"},
    },
    # Send daily digest at 8am IST
    "daily-digest": {
        "task": "apps.jobs.tasks.send_daily_digest",
        "schedule": 86400.0,
        "options": {"queue": "notifications"},
    },
}
