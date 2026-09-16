import bcrypt from 'bcryptjs';
import BaseClass from '../../base/base-class/base-class.js';

class PasswordManager extends BaseClass {
  private readonly saltRounds: number;
  constructor() {
    super();
    this.saltRounds = this.config.application.passwordManager.saltRounds;
  }

  async createPasswordHash({ password }: { password: string }): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verifyPasswordHash({ password, passwordHash }: { password: string, passwordHash: string }): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}

export default PasswordManager;