import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jobpilot.settings")

application = get_wsgi_application()

# ── DB connection check on startup ──────────────
import logging
logger = logging.getLogger(__name__)
try:
    from django.db import connection
    connection.ensure_connection()
    logger.info("✅ DATABASE CONNECTED — Supabase OK")
except Exception as e:
    logger.error("❌ DATABASE FAILED: %s", e)