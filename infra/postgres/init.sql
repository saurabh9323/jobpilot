-- ─────────────────────────────────────────────
--  JobPilot AI — PostgreSQL init
-- ─────────────────────────────────────────────

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram search for fuzzy matching
CREATE EXTENSION IF NOT EXISTS unaccent;   -- normalise Indian company names
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE jobpilot TO jobpilot;
