import type { Request, Response, NextFunction } from 'express';
import { TokenManager } from '../../utils/token-manager/token-manager.js';
import BaseClass from '../../base/base-class/base-class.js';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError } from '../../exceptions/exceptions.js';
import { setContextUserId, setRequestContext } from '../../utils/request-context/request-context.js';

class AuthorizationMiddleware extends BaseClass {
  private readonly tokenManager: TokenManager;
  constructor() {
    super();
    this.tokenManager = new TokenManager();
  }
  verifyAccessToken() {
    return (req: Request, res: Response, next: NextFunction): void => {
      setRequestContext({ className: 'AuthorizationMiddleware', methodName: 'verifyAccessToken' });

      const { publicRoutes } = this.config.application;
      if (publicRoutes.includes(req.path)) {
        next();
        return;
      }
      const authHeader = req.headers.authorization;
      if (authHeader === undefined || authHeader === null) {
        res.status(StatusCodes.PRECONDITION_FAILED).send({ message: 'Authorization header missing', code: 'NO_AUTH_HEADER' });
        return;
      }

      const [ type, accessToken ] = authHeader.split(' ');

      if (type !== 'Bearer') {
        res.status(StatusCodes.PRECONDITION_FAILED).send({ message: 'Invalid token type', code: 'INVALID_AUTH_HEADER_TYPE' });
        return;
      }

      // A thrown error here (this deliberate one, or a raw jsonwebtoken error for a malformed/
      // tampered token) is a synchronous throw from within Express's own middleware dispatch,
      // which Express catches and forwards to the centralized error-handling middleware itself -
      // no local try/catch needed.
      const payload = this.tokenManager.verifyAccessToken({ accessToken });

      if (payload?.userId === null || payload?.userId === undefined) {
        throw new UnauthorizedError({ message: 'Invalid or expired token', code: 'INVALID_TOKEN' });
      }

      req.user = payload.userId as string;
      setContextUserId(req.user);
      next();
    };
  }
  handleUserId(req: Request): string {
    if (req.user === undefined || req.user === null) throw new UnauthorizedError({ message: 'User Id not found', code: 'MISSING_USER_ID' });
    return req.user;
  }

  handleGetRefreshToken(req: Request): string | undefined {
    if (req.platformType !== 'mobile') return req.cookies?.refreshToken as string | undefined;

    return req.headers['refresh-token'] as string | undefined;
  }
}

export default AuthorizationMiddleware;
