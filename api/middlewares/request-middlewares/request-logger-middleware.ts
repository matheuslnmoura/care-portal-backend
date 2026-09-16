import type { Request, Response, NextFunction } from 'express';
import type { Logger } from '../../config/logger/logger.js';

const requestLoggerMiddleware = (logger: Logger) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    logger.info({
      actor: 'unknown',
      className: 'Middleware',
      method: 'requestLoggerMiddleware',
      logMessage: `Incoming request: ${req.method} ${req.originalUrl}`,
      req
    });

    next();
  };
};

export default requestLoggerMiddleware;
