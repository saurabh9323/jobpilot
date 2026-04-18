"""
apps/scraper/tasks.py — Celery tasks that orchestrate Playwright scrapers
"""
import logging
import subprocess
from datetime import datetime

try:
    from celery import shared_task
except ImportError:
    def shared_task(*args, **kwargs):
        def decorator(func):
            return func
        if len(args) == 1 and callable(args[0]):
            return args[0]
        return decorator

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    queue="scraping",
    max_retries=2,
    name="apps.scraper.tasks.scrape_portal",
)
def scrape_portal(self, portal: str):
    """
    Trigger the Node.js Playwright scraper for a specific portal.
    Called by the Express gateway worker OR directly via Celery Beat.
    """
    from apps.jobs.models import ScrapeRun
    import os

    run = ScrapeRun.objects.create(portal=portal, status="running")

    try:
        result = subprocess.run(
            ["npx", "ts-node", "/scraper/src/index.ts", f"--portals={portal}"],
            capture_output=True,
            text=True,
            timeout=300,
            env={
                **os.environ,
                "DJANGO_URL": "http://django:8000",
                "HEADLESS": "true",
            },
        )

        if result.returncode != 0:
            raise RuntimeError(f"Scraper exited with code {result.returncode}: {result.stderr[-500:]}")

        import re
        match = re.search(r"(\d+) found, (\d+) new", result.stdout)
        jobs_found = int(match.group(1)) if match else 0
        jobs_new   = int(match.group(2)) if match else 0

        run.status = "done"
        run.jobs_found = jobs_found
        run.jobs_new = jobs_new
        run.finished_at = datetime.now()
        run.save()

        logger.info("Scrape completed: %s — %d new jobs", portal, jobs_new)
        return {"portal": portal, "jobs_found": jobs_found, "jobs_new": jobs_new}

    except Exception as exc:
        run.status = "failed"
        run.error = str(exc)
        run.finished_at = datetime.now()
        run.save()
        logger.error("Scrape failed: %s — %s", portal, exc)
        if hasattr(self, 'retry'):
            raise self.retry(exc=exc)
        raise exc


@shared_task(queue="scraping", name="apps.scraper.tasks.scrape_all_portals")
def scrape_all_portals():
    """Scrape all configured portals. Runs every 4h via Celery Beat."""
    portals = ["linkedin", "naukri"]
    for portal in portals:
        scrape_portal.apply_async(args=[portal], queue="scraping")
    return {"queued": portals}