-- Initial schema for the CarePortal backend: tenants (clinics/hospitals), their staff/provider
-- accounts, and refresh-token-based session management. Every tenant-scoped table carries
-- tenant_id from the start, ahead of the Tenant/RBAC application-layer work landing in Phase 1.
--
-- staff_users (not a generic "users") because patient identity is a structurally different
-- principal - many-to-many to tenants, no admin provisioning, no adult-age requirement, and per
-- this project's data-ownership design it belongs in FHIR, not this app's own password table.
-- See api/modules/auth/credential.ts for the shared AuthCredential/CredentialProvider contract
-- this split is built around.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE staff_user_status AS ENUM ('active', 'disabled', 'deleted');

-- Tenant = a clinic/hospital. Kept minimal here; ownership/status fields land in Phase 1
-- alongside the RBAC work that actually needs them.
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  birthdate DATE NOT NULL,
  name TEXT NOT NULL,
  status staff_user_status NOT NULL DEFAULT 'active',
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_staff_users_minimum_age CHECK (birthdate <= (CURRENT_DATE - INTERVAL '18 years')),
  CONSTRAINT staff_users_public_id_unique UNIQUE (public_id)
);

CREATE INDEX idx_staff_users_tenant_id ON staff_users (tenant_id);

CREATE TABLE staff_user_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
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

CREATE UNIQUE INDEX ux_staff_user_refresh_tokens_token_hash ON staff_user_refresh_tokens (token_hash);
CREATE INDEX ix_staff_user_refresh_tokens_user_id ON staff_user_refresh_tokens (user_id);
CREATE INDEX idx_staff_user_refresh_tokens_tenant_id ON staff_user_refresh_tokens (tenant_id);
