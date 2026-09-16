ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS refresh_tokens_hash TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE users
  ADD CONSTRAINT users_public_id_unique UNIQUE (public_id);

