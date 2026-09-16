import type { Request, Response, NextFunction } from 'express';
import BaseClass from '../../base/base-class/base-class.js';

interface PlatformInterface {
  platformType: string;
  platform : string
}

class PlatformMiddleware extends BaseClass {
  private parseUserAgent(userAgent?: string): PlatformInterface {
    let platformType: PlatformInterface['platformType'] = 'web';
    let platform: PlatformInterface['platform'] = 'unknown';

    if (userAgent === undefined) return { platformType, platform };

    const mobilePlatforms = [
      { regex: /Android/i, platform: 'android' },
      { regex: /iPhone|iPad|iPod/i, platform: 'ios' }
    ];

    for (const mobile of mobilePlatforms) {
      if (mobile.regex.test(userAgent)) {
        return { platformType: 'mobile', platform: mobile.platform };
      }
    }

    const desktopPlatforms = [
      { regex: /Windows NT/i, platform: 'windows' },
      { regex: /Macintosh|Mac OS X/i, platform: 'macos' },
      { regex: /Linux/i, platform: 'linux' }
    ];

    for (const desktop of desktopPlatforms) {
      if (desktop.regex.test(userAgent)) {
        platform = desktop.platform;
        break;
      }
    }

    return { platformType, platform };
  }
  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const userAgent = req.headers['user-agent'];
      const { platformType, platform } = this.parseUserAgent(userAgent);

      req.platformType = platformType;
      req.platform = platform;

      next();
    };
  }
}

export default PlatformMiddleware;
