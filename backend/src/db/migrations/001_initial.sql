CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  username text NOT NULL CHECK (username = lower(username) AND username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  password_hash text NOT NULL,
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (username),
  UNIQUE (id, username)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  csrf_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_active_idx ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE emails (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  sha256 char(64) NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  state text NOT NULL CHECK (state IN ('staging', 'ready', 'processing', 'completed', 'partial', 'failed', 'deleted')),
  parsed_observations jsonb,
  parser_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX emails_owner_hash_live_idx ON emails(user_id, sha256) WHERE deleted_at IS NULL;
CREATE INDEX emails_owner_created_idx ON emails(user_id, created_at DESC) WHERE deleted_at IS NULL;
ALTER TABLE emails ADD CONSTRAINT emails_id_user_unique UNIQUE (id, user_id);

CREATE TABLE evidence_objects (
  id uuid PRIMARY KEY,
  email_id uuid NOT NULL UNIQUE REFERENCES emails(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  sha256 char(64) NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  state text NOT NULL CHECK (state IN ('staged', 'ready', 'deleted', 'orphaned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE analysis_jobs (
  id uuid PRIMARY KEY,
  email_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('initial', 'reanalysis')),
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'retrying', 'completed', 'partial', 'failed', 'cancelled')),
  stage text NOT NULL CHECK (stage IN ('queued', 'parsing', 'analysing', 'persisting', 'completed', 'partial', 'failed', 'cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lease_until IS NULL OR lease_token IS NOT NULL),
  FOREIGN KEY (email_id, user_id) REFERENCES emails(id, user_id) ON DELETE CASCADE
);
CREATE INDEX jobs_claim_idx ON analysis_jobs(status, available_at, lease_until, created_at);
CREATE INDEX jobs_owner_idx ON analysis_jobs(user_id, created_at DESC);

CREATE TABLE analyses (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL UNIQUE REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  email_id uuid NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  engine_version text NOT NULL,
  rules_version text NOT NULL,
  scoring_version text NOT NULL,
  model_version text,
  status text NOT NULL CHECK (status IN ('completed', 'partial', 'inconclusive')),
  risk_index integer CHECK (risk_index BETWEEN 0 AND 100),
  risk_band text CHECK (risk_band IN ('low', 'guarded', 'elevated', 'high') OR risk_band IS NULL),
  completeness text NOT NULL CHECK (completeness IN ('complete', 'partial', 'insufficient')),
  evidence_confidence text NOT NULL CHECK (evidence_confidence IN ('low', 'medium', 'high')),
  subject text,
  sender_summary jsonb,
  observations jsonb NOT NULL,
  authentication jsonb NOT NULL,
  score_breakdown jsonb NOT NULL,
  ml_result jsonb NOT NULL,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_id, version)
);
CREATE INDEX analyses_email_created_idx ON analyses(email_id, created_at DESC);

CREATE TABLE findings (
  id uuid PRIMARY KEY,
  analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  rule_id text NOT NULL,
  rule_version text NOT NULL,
  category text NOT NULL CHECK (category IN ('sender', 'url', 'content', 'attachment')),
  severity text NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high')),
  evidence_refs jsonb NOT NULL,
  explanation text NOT NULL,
  limitations jsonb NOT NULL,
  recommended_action text NOT NULL,
  score_contribution integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, rule_id)
);

CREATE TABLE indicators (
  id uuid PRIMARY KEY,
  analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  original_value text NOT NULL,
  normalized_value text,
  evidence_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX indicators_analysis_idx ON indicators(analysis_id);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  resource_type text,
  resource_id uuid,
  request_id uuid,
  outcome text NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_user_created_idx ON audit_events(user_id, created_at DESC);
