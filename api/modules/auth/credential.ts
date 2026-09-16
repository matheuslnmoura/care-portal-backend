// The minimal shape AuthService actually needs from any principal it authenticates. Deliberately
// excludes anything account-creation-related (signup fields differ per principal type) and doesn't
// need email as an output field - email is only ever used as a lookup key, never read back off an
// already-resolved credential.
export interface AuthCredential {
  id: string;
  userId: string;
  passwordHash: string;
}

export interface CredentialProvider<T extends AuthCredential> {
  findByEmail(params: { email: string }): Promise<T | null>;
  findById(params: { userId: string }): Promise<T | null>;
}
