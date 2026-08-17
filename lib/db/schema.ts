export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('CUSTOMER','CONTENT_EDITOR','ADMIN','SUPER_ADMIN')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('DESK','MOBILE','FOCUS','TRAVEL')),
  short_description text NOT NULL,
  description text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  compare_at_price integer,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','HIDDEN')),
  accent text NOT NULL DEFAULT '#0047ff',
  image_url text,
  detail_page_version_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_facts (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  fact_key text NOT NULL,
  fact_value text NOT NULL,
  evidence text NOT NULL,
  status text NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('VERIFIED','REVIEW_REQUIRED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, fact_key)
);

CREATE TABLE IF NOT EXISTS product_assets (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ORIGINAL','GENERATED_SCENE','DETAIL_BLOCK','SHORT_ASSET')),
  url text NOT NULL,
  alt_text text NOT NULL,
  provenance text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carts (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  session_key text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CONVERTED','ABANDONED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id text PRIMARY KEY,
  cart_id text NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price integer NOT NULL CHECK (unit_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  email text NOT NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('DRAFT','PAYMENT_PENDING','PAID','PAYMENT_FAILED','FULFILLMENT_READY','CANCEL_REQUESTED','CANCELED')),
  currency text NOT NULL DEFAULT 'KRW',
  subtotal integer NOT NULL,
  shipping_fee integer NOT NULL DEFAULT 0,
  total_amount integer NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price integer NOT NULL,
  line_total integer NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'TOSS_PAYMENTS',
  payment_key text UNIQUE,
  method text,
  status text NOT NULL CHECK (status IN ('READY','AUTHENTICATED','APPROVED','CANCEL_REQUESTED','CANCELED','FAILED','UNKNOWN')),
  requested_amount integer NOT NULL,
  approved_amount integer,
  receipt_url text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_events (
  id text PRIMARY KEY,
  payment_id text REFERENCES payments(id) ON DELETE CASCADE,
  order_id text REFERENCES orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  provider_event_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'RECEIVED',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_event_id)
);

CREATE TABLE IF NOT EXISTS payment_cancellations (
  id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  reason text NOT NULL,
  amount integer NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('REQUESTED','COMPLETED','FAILED')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_configs (
  id text PRIMARY KEY,
  kind text NOT NULL,
  provider text NOT NULL,
  label text NOT NULL,
  environment text NOT NULL DEFAULT 'TEST' CHECK (environment IN ('TEST','LIVE')),
  status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN ('UNCONFIGURED','UNVERIFIED','READY','FAILED','DISABLED')),
  encrypted_secret text,
  secret_nonce text,
  secret_tag text,
  key_suffix text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  credential_version integer NOT NULL DEFAULT 1,
  last_checked_at timestamptz,
  last_check_message text,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kind, environment)
);

CREATE TABLE IF NOT EXISTS integration_health_checks (
  id text PRIMARY KEY,
  integration_id text NOT NULL REFERENCES integration_configs(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('PASSED','FAILED','SKIPPED')),
  message text NOT NULL,
  latency_ms integer,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  session_key text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','HANDED_OFF','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('USER','ASSISTANT','TOOL','SYSTEM')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  model_provider text,
  model_name text,
  status text NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED','HANDED_OFF')),
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS agent_tool_calls (
  id text PRIMARY KEY,
  agent_run_id text NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('REQUESTED','COMPLETED','REJECTED','FAILED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id text PRIMARY KEY,
  conversation_id text REFERENCES conversations(id) ON DELETE SET NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detail_page_versions (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','REJECTED')),
  title text NOT NULL,
  seo_title text NOT NULL,
  seo_description text NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  claim_report jsonb NOT NULL DEFAULT '[]'::jsonb,
  generation_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL,
  reviewed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, version)
);

CREATE TABLE IF NOT EXISTS short_projects (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  detail_page_version_id text NOT NULL REFERENCES detail_page_versions(id),
  status text NOT NULL CHECK (status IN ('DRAFT','SCRIPT_READY','QUEUED','RENDERING','READY','FAILED')),
  duration_seconds integer NOT NULL CHECK (duration_seconds IN (15,30)),
  angle text NOT NULL,
  selected_hook text,
  hooks jsonb NOT NULL DEFAULT '[]'::jsonb,
  script jsonb NOT NULL DEFAULT '[]'::jsonb,
  render_artifact_url text,
  caption_url text,
  thumbnail_url text,
  error_message text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('DETAIL_GENERATION','IMAGE_GENERATION','TTS_GENERATION','SHORT_RENDER','INTEGRATION_CHECK')),
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELED')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  idempotency_key text NOT NULL UNIQUE,
  error_message text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_status_category ON products(status, category);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_detail_product_version ON detail_page_versions(product_id, version DESC);
`;
