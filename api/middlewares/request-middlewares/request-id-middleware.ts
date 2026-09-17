import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { requestContextStorage } from '../../utils/request-context/request-context.js';

function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = crypto.randomUUID();
    req.requestId = requestId;

    requestContextStorage.run({ requestId }, () => {
      next();
    });
  };
}

export default requestIdMiddleware;