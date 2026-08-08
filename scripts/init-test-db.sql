-- A dedicated database for integration tests, created on first container start.
--
-- Tests truncate tables between cases, so they must never be able to touch
-- development data. A separate database makes that structural rather than a
-- matter of remembering to point DATABASE_URL somewhere safe.
CREATE DATABASE samjho_test OWNER samjho;
