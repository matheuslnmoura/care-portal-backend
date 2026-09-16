import { describe, expect, it } from 'vitest';
import PasswordManager from '../password-manager.js';

describe('PasswordManager', () => {
  const passwordManager = new PasswordManager();

  describe('createPasswordHash', () => {
    it('returns a hash that is not the plain text password', async () => {
      const hash = await passwordManager.createPasswordHash({ password: 'super-secret' });

      expect(hash).not.toBe('super-secret');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('salts the hash so the same password hashes differently each time', async () => {
      const [ hashA, hashB ] = await Promise.all([
        passwordManager.createPasswordHash({ password: 'super-secret' }),
        passwordManager.createPasswordHash({ password: 'super-secret' })
      ]);

      expect(hashA).not.toBe(hashB);
    });
  });

  describe('verifyPasswordHash', () => {
    it('resolves true for a password that matches its hash', async () => {
      const passwordHash = await passwordManager.createPasswordHash({ password: 'super-secret' });

      const isMatch = await passwordManager.verifyPasswordHash({ password: 'super-secret', passwordHash });

      expect(isMatch).toBe(true);
    });

    it('resolves false for a password that does not match its hash', async () => {
      const passwordHash = await passwordManager.createPasswordHash({ password: 'super-secret' });

      const isMatch = await passwordManager.verifyPasswordHash({ password: 'wrong-password', passwordHash });

      expect(isMatch).toBe(false);
    });
  });
});
