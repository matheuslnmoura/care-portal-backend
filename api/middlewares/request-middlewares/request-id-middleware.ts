import { nanoid } from 'nanoid';
import type { Request, Response, NextFunction } from 'express';
import { requestContextStorage } from '../../utils/request-context/request-context';

function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = nanoid();
    req.requestId = requestId;

    requestContextStorage.run({ requestId }, () => {
      next();
    });
  };
}

export default requestIdMiddleware;