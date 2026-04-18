# ─────────────────────────────────────────────────────────────
#  JobPilot AI — Makefile
#  Usage: make <command>
# ─────────────────────────────────────────────────────────────

.PHONY: up down restart logs ps build clean migrate scrape shell-django shell-pg

## Start all services
up:
	docker compose up -d
	@echo "\n✅  JobPilot is running:"
	@echo "   Frontend  →  http://localhost:3000"
	@echo "   Gateway   →  http://localhost:4000"
	@echo "   Django    →  http://localhost:8000"
	@echo "   API docs  →  http://localhost:8000/api/schema/swagger-ui/\n"

## Start with live logs
up-logs:
	docker compose up

## Stop all services
down:
	docker compose down

## Rebuild and restart
restart:
	docker compose down
	docker compose build --no-cache
	docker compose up -d

## View logs (all services or specific: make logs s=django)
logs:
	docker compose logs -f $(s)

## List running containers
ps:
	docker compose ps

## Build images
build:
	docker compose build

## Run Django migrations
migrate:
	docker compose exec django python manage.py migrate

## Create Django superuser
superuser:
	docker compose exec django python manage.py createsuperuser

## Trigger manual scrape (portal=linkedin|naukri|all)
scrape:
	curl -s -X POST http://localhost:4000/api/scraper/trigger \
		-H "Content-Type: application/json" \
		-d '{"portal":"$(or $(portal),all)"}' | python3 -m json.tool

## Open Django shell
shell-django:
	docker compose exec django python manage.py shell_plus

## Open PostgreSQL shell
shell-pg:
	docker compose exec postgres psql -U jobpilot -d jobpilot

## Open Redis CLI
shell-redis:
	docker compose exec redis redis-cli

## Tail Celery worker logs
worker-logs:
	docker compose logs -f worker

## Run Django tests
test:
	docker compose exec django python manage.py test

## Clean everything (⚠️ deletes volumes + data)
clean:
	docker compose down -v --remove-orphans
	docker system prune -f

## Copy .env.example to .env if it doesn't exist
env:
	@test -f .env || (cp .env.example .env && echo "✅  .env created — fill in your API keys")
