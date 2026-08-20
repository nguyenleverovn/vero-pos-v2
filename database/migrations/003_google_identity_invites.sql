BEGIN;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE auth_identities (
  provider text NOT NULL CHECK (provider IN ('google')),
  provider_subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_subject),
  UNIQUE (user_id, provider)
);

CREATE TABLE invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  label text NOT NULL CHECK (length(trim(label)) > 0),
  expires_at timestamptz,
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0 AND used_count <= max_uses),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
