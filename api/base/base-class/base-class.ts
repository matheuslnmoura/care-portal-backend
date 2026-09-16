import type { ConfigType } from '../../config/environment-config/config.types';
import type { RequestContextFields } from '../../utils/request-context/request-context';
import { Logger } from '../../config/logger/logger';
import config from '../../config/environment-config/config';

class BaseClass {
  protected config: ConfigType;
  protected env: string;
  protected logger: Logger;
  protected context: RequestContextFields = {};

  constructor() {
    this.env = process.env.APPLICATION_ENVIRONMENT ?? 'default';
    this.config = config;
    this.logger = new Logger({ env: this.env, config: this.config });
  }
}

export default BaseClass;