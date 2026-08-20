BEGIN;

ALTER TABLE stores
  ADD COLUMN phone text,
  ADD COLUMN address text;

COMMIT;
