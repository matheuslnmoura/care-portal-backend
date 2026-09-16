-- Core schema for users and related profiles

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_status AS ENUM ('active', 'disabled', 'deleted');
CREATE TYPE media_asset_type AS ENUM ('video', 'photo');

CREATE TABLE experience_ranges (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order SMALLINT NOT NULL
);

CREATE TABLE instruments (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE music_genres (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE technical_services (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE availability_options (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  birthdate DATE NOT NULL,
  name TEXT NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_users_minimum_age CHECK (birthdate <= (CURRENT_DATE - INTERVAL '18 years'))
);

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  timezone TEXT,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE musician_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE musician_instruments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument_slug TEXT NOT NULL REFERENCES instruments(slug),
  experience_range_code TEXT NOT NULL REFERENCES experience_ranges(code),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, instrument_slug)
);

CREATE UNIQUE INDEX idx_musician_instruments_primary
  ON musician_instruments (user_id)
  WHERE is_primary IS TRUE;

CREATE TABLE musician_genres (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  genre_slug TEXT NOT NULL REFERENCES music_genres(slug),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, genre_slug)
);

CREATE TABLE musician_availability (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  availability_code TEXT NOT NULL REFERENCES availability_options(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, availability_code)
);

CREATE TABLE technical_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE technical_services_users (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_slug TEXT NOT NULL REFERENCES technical_services(slug),
  experience_range_code TEXT NOT NULL REFERENCES experience_ranges(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, service_slug)
);

CREATE TABLE user_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type media_asset_type NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 's3',
  bucket TEXT,
  object_key TEXT,
  url TEXT,
  caption TEXT,
  position SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (position BETWEEN 1 AND 10)
);

CREATE UNIQUE INDEX uniq_user_media_type_position
  ON user_media_assets (user_id, type, position);

CREATE INDEX idx_user_media_user
  ON user_media_assets (user_id);

CREATE TABLE user_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_status user_status NOT NULL,
  new_status user_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT
);

CREATE INDEX idx_user_status_history_user
  ON user_status_history (user_id);

