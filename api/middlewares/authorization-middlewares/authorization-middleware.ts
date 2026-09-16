import type { Request, Response, NextFunction } from 'express';
import { TokenManager } from '../../utils/token-manager/token-manager';
import BaseClass from '../../base/base-class/base-class';
import { StatusCodes } from 'http-status-codes';
import { CustomRequestError, UnauthorizedError } from '../../exceptions/exceptions';
import { setContextUserId, setRequestContext } from '../../utils/request-context/request-context';

class AuthorizationMiddleware extends BaseClass {
  private readonly tokenManager: TokenManager;
  constructor() {
    super();
    this.tokenManager = new TokenManager();
  }
  verifyAccessToken() {
    return (req: Request, res: Response, next: NextFunction): void => {
      setRequestContext({ className: 'AuthorizationMiddleware', methodName: 'verifyAccessToken' });

      try {
        const { publicRoutes } = this.config.application;
        if (publicRoutes.includes(req.path)) {
          return next();
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

        const payload = this.tokenManager.verifyAccessToken({ accessToken });

        if (payload?.userId === null || payload?.userId === undefined ) {
          throw new UnauthorizedError({ message: 'Invalid or expired token', code: 'INVALID_TOKEN' });
        }

        req.user = payload.userId as string;
        setContextUserId(req.user);
        next();

      } catch (error) {
        res.errorDetails = error;
        let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
        let message = 'Error verifying accessToken';
        let code: string | undefined = 'INTERNAL_SERVER_ERROR';

        if (error instanceof CustomRequestError) {
          statusCode = error.statusCode;
          message = error.message;
          code = error.code;
        }

        res.status(statusCode).send({ message, code });
      }
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
