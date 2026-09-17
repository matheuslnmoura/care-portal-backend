-- Tightens staff_users.public_id from TEXT to a native UUID column, matching id/tenant_id - it
-- already only ever holds UUID-formatted values app-side (crypto.randomUUID()) or via this
-- column's own default. Existing rows are truncated first: this project is pre-launch with only
-- disposable local/test data, and the old values (nanoid-generated) aren't valid UUIDs, so there's
-- nothing to migrate in place.
TRUNCATE TABLE staff_users CASCADE;

ALTER TABLE staff_users
  ALTER COLUMN public_id DROP DEFAULT,
  ALTER COLUMN public_id TYPE UUID USING public_id::uuid,
  ALTER COLUMN public_id SET DEFAULT gen_random_uuid();
