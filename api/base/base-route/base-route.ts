import BaseClass from '../base-class/base-class.js';

class BaseRoute extends BaseClass {
  getBasePath(subPath: string): string {
    return `${this.config.app.baseRoute}${subPath}`;
  }
}

export default BaseRoute;