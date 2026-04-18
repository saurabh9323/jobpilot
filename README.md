# JobPilot AI 🚀

> Autonomous AI-powered job hunt platform. Discovers, scores, applies, and tracks — hands-free.

## Architecture

```
┌────────────┐    ┌─────────────────┐    ┌───────────────────────┐
│  Next.js   │────│  Express        │────│  Django REST + Celery │
│  Frontend  │    │  API Gateway    │    │  AI/ML Backend        │
│  :3000     │    │  :4000          │    │  :8000                │
└────────────┘    │  · Socket.io    │    │  · sentence-          │
                  │  · BullMQ       │    │    transformers       │
                  │  · Playwright   │    │  · spaCy NLP          │
                  └─────────────────┘    │  · pgvector ATS       │
                                         └───────────────────────┘
                  ┌──────────┐  ┌───────┐  ┌──────────────────┐
                  │ Postgres │  │ Redis │  │ Elasticsearch    │
                  │ +pgvector│  │  :6379│  │ :9200            │
                  └──────────┘  └───────┘  └──────────────────┘
```

## Week 1 — Quickstart

### Prerequisites
- Docker Desktop 4.x+
- Node.js 20+ (for local scraper dev)
- Python 3.11+ (optional — Docker handles it)

### 1. Clone & configure

```bash
git clone https://github.com/you/jobpilot-ai.git
cd jobpilot-ai
make env          # copies .env.example → .env
nano .env         # fill in ANTHROPIC_API_KEY, HUNTER_API_KEY etc.
```

### 2. Boot all 8 services

```bash
make up
```

First boot takes ~3–5 min (pulls images, installs Python deps, downloads spaCy model).

### 3. Run migrations

```bash
make migrate
make superuser    # create admin account
```

### 4. Export LinkedIn cookies

1. Install the [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie) Chrome extension
2. Log in to LinkedIn in Chrome
3. Click EditThisCookie → Export → copy JSON
4. Save to `scraper/cookies/linkedin.json`

### 5. Trigger your first scrape

```bash
make scrape portal=linkedin
# or via the dashboard → "Scrape now" button
```

Jobs will appear in the dashboard in real time via Socket.io.

## Services overview

| Service    | URL                                      | Purpose                          |
|------------|------------------------------------------|----------------------------------|
| Frontend   | http://localhost:3000                    | Next.js dashboard                |
| Gateway    | http://localhost:4000                    | Express API + Socket.io          |
| Django     | http://localhost:8000                    | AI/ML REST API                   |
| Admin      | http://localhost:8000/admin/             | Django admin                     |
| API Docs   | http://localhost:8000/api/schema/swagger-ui/ | Auto-generated OpenAPI docs |
| Postgres   | localhost:5432                           | Primary database + pgvector      |
| Redis      | localhost:6379                           | Queue broker + cache             |
| Elastic    | http://localhost:9200                    | Full-text job search             |

## Week 1 scope (what's built)

- [x] `docker-compose.yml` — all 8 services wired
- [x] Next.js 14 scaffold with App Router, Tailwind, React Query, Socket.io
- [x] Express gateway with BullMQ queues + Socket.io real-time events
- [x] Django REST API — jobs, applications, scrape runs
- [x] pgvector models for semantic job-matching
- [x] Celery worker + Beat scheduler (scrape every 4h, score every 1h)
- [x] Playwright LinkedIn scraper with stealth + cookie auth
- [x] Playwright Naukri scraper with API interception
- [x] AI scoring task (sentence-transformers cosine similarity)
- [x] Claude API cover letter generator
- [x] HR contact finder (Hunter.io + Apollo.io)
- [x] Dashboard with funnel chart + live top-matches feed
- [x] Nginx reverse proxy

## Week 2 roadmap

- [ ] Auto-apply via Playwright form-fill (LinkedIn Easy Apply, Naukri Quick Apply)
- [ ] Gmail OAuth integration for tracking replies
- [ ] ATS gap analysis with keyword extraction
- [ ] Interview prep MCQ engine (AI-generated, role-specific)
- [ ] Salary negotiation coach
- [ ] LinkedIn profile optimizer
- [ ] Referral finder (2nd-degree connections at target companies)

## Folder structure

```
jobpilot/
├── docker-compose.yml
├── Makefile
├── .env.example
├── nginx/               nginx.conf
├── infra/postgres/      init.sql
├── frontend/            Next.js 14
│   └── src/
│       ├── app/         pages (App Router)
│       ├── components/  UI + layout + dashboard
│       └── lib/         typed API client
├── gateway/             Express + BullMQ + Socket.io
│   └── src/
│       ├── routes/      scraper, hr-finder, auth, notifications
│       └── middleware/  JWT auth
├── django/              Django REST + Celery + AI/ML
│   ├── jobpilot/        settings, urls, celery
│   └── apps/
│       ├── jobs/        models, serializers, views
│       ├── ai/          scoring tasks, cover letter, ATS
│       ├── scraper/     Celery scrape tasks
│       └── users/       User model, JWT auth
└── scraper/             Playwright scrapers (TypeScript)
    └── src/
        ├── index.ts     orchestrator
        ├── linkedin.ts  LinkedIn scraper
        ├── naukri.ts    Naukri scraper
        ├── types.ts     shared types
        └── utils.ts     delays, parsers, user-agents
```
