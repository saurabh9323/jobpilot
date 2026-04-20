import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jobpilot.settings")

application = get_wsgi_application()

import logging
logger = logging.getLogger(__name__)
try:
    from django.db import connection
    connection.ensure_connection()
    logger.info("✅ DATABASE CONNECTED — Supabase OK")
    
    from django.core.management import call_command
    call_command("migrate", verbosity=1)        # runs all migrations including auth
    call_command("migrate", "--run-syncdb", verbosity=1)  # creates unmigrated app tables
    logger.info("✅ MIGRATIONS DONE")
    
except Exception as e:
    logger.error("❌ DATABASE FAILED: %s", e)