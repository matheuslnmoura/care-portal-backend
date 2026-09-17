// The minimal shape AuthService actually needs from any principal it authenticates. Deliberately
// excludes anything account-creation-related (signup fields differ per principal type) and doesn't
// need email as an output field - email is only ever used as a lookup key, never read back off an
// already-resolved credential.
//
// tenantId is here because refresh-token storage (staff_user_refresh_tokens.tenant_id) needs it,
// and today's only principal (staff) has exactly one tenant. Revisit this field, not necessarily
// keep it as-is, once a second principal type (e.g. patients, many-to-many to tenants) exists.
export interface AuthCredential {
  id: string;
  userId: string;
  tenantId: string;
  passwordHash: string;
}

export interface CredentialProvider<T extends AuthCredential> {
  findByEmail(params: { email: string }): Promise<T | null>;
  findById(params: { userId: string }): Promise<T | null>;
}
