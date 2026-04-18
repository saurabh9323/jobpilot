"""
Management command: wait_for_db
Blocks until PostgreSQL is accepting connections.
Used in docker-compose to avoid Django starting before Postgres is ready.
"""
import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    help = "Waits for the database to be available"

    def handle(self, *args, **options):
        self.stdout.write("Waiting for database...")
        db_conn = None
        attempts = 0
        while not db_conn:
            try:
                db_conn = connections["default"]
                db_conn.ensure_connection()
                self.stdout.write(self.style.SUCCESS("Database available ✓"))
            except OperationalError:
                attempts += 1
                self.stdout.write(f"Database unavailable, attempt {attempts}, waiting 1s...")
                time.sleep(1)
                if attempts > 60:
                    self.stdout.write(self.style.ERROR("Database never became available"))
                    raise SystemExit(1)
