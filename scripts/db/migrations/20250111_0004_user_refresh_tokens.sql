CREATE TABLE user_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  device_id TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_user_refresh_tokens_token_hash
  ON user_refresh_tokens (token_hash);

CREATE INDEX ix_user_refresh_tokens_user_id
  ON user_refresh_tokens (user_id);

ALTER TABLE users
  DROP COLUMN IF EXISTS refresh_tokens_hash;

