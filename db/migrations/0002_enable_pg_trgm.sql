-- Trigram search for foods (GIN index on foods.search_name). Trusted extension: the DB owner may create it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;