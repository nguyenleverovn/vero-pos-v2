BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  email text,
  phone text,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_phone_unique ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  currency_code char(3) NOT NULL DEFAULT 'VND',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE store_memberships (
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, user_id)
);

CREATE TABLE devices (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  label text,
  sync_cursor bigint NOT NULL DEFAULT 0 CHECK (sync_cursor >= 0),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id)
);

CREATE INDEX categories_store_order_idx ON categories (store_id, sort_order) WHERE deleted_at IS NULL;

CREATE TABLE products (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id uuid,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  price_vnd bigint NOT NULL CHECK (price_vnd >= 0),
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, category_id) REFERENCES categories(store_id, id)
);

CREATE INDEX products_store_category_order_idx
  ON products (store_id, category_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE TABLE orders (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'completed', 'voided')),
  payment_method text CHECK (payment_method IN ('cash', 'transfer', 'other')),
  subtotal_vnd bigint NOT NULL CHECK (subtotal_vnd >= 0),
  total_vnd bigint NOT NULL CHECK (total_vnd >= 0),
  completed_at timestamptz,
  voided_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, idempotency_key),
  UNIQUE (store_id, id)
);

CREATE INDEX orders_store_created_idx ON orders (store_id, created_at DESC);

CREATE TABLE order_items (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid,
  product_name_snapshot text NOT NULL,
  category_name_snapshot text,
  unit_price_vnd bigint NOT NULL CHECK (unit_price_vnd >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total_vnd bigint NOT NULL CHECK (line_total_vnd >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (store_id, order_id) REFERENCES orders(store_id, id) ON DELETE CASCADE,
  FOREIGN KEY (store_id, product_id) REFERENCES products(store_id, id) ON DELETE SET NULL
);

CREATE INDEX order_items_order_idx ON order_items (store_id, order_id);

CREATE TABLE sync_mutations (
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  client_mutation_id uuid NOT NULL,
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  mutation_type text NOT NULL,
  response_payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, client_mutation_id)
);

CREATE TABLE sync_changes (
  sequence_id bigserial PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('upsert', 'delete')),
  entity_version integer NOT NULL CHECK (entity_version > 0),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sync_changes_store_sequence_idx ON sync_changes (store_id, sequence_id);

COMMIT;
