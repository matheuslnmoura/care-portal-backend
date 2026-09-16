import type { Request, Response } from 'express';
import BaseController from '../../base/base-controller/base-controller';
import AuthService from './service/auth-service';
import { ForbiddenError } from '../../exceptions/exceptions';
import { StatusCodes } from 'http-status-codes';
import AuthorizationMiddleware from '../../middlewares/authorization-middlewares/authorization-middleware';
import type { LoginBodyInterface, SignUpBodyInterface } from './schema/schema';
import { setContextUserId, setRequestContext } from '../../utils/request-context/request-context';

class AuthController extends BaseController {
  private readonly service: AuthService;
  private readonly authorizationMiddleware: AuthorizationMiddleware;
  constructor() {
    super();
    this.service = new AuthService();
    this.authorizationMiddleware = new AuthorizationMiddleware();
    this.context = { className: 'AuthController' };
  }

  async signUp(req: Request, res: Response): Promise<void> {
    try {
      setRequestContext({ ...this.context, methodName: 'signUp' });
      const { name, email, password, phone, birthdate } = req.body as SignUpBodyInterface;

      const user = await this.service.createUser({ name, email, password, phone, birthdate });

      res.status(StatusCodes.OK).send({ userId: user.userId, name: user.name, email: user.contacts.email, phone: user.contacts.phone });
    } catch (error: unknown) {
      this.handleError(error, res);
    }
  }
  async login(req: Request, res: Response): Promise<void> {
    try {
      setRequestContext({ ...this.context, methodName: 'login' });
      const { email, password } = req.body as LoginBodyInterface;

      const { accessToken, refreshToken, userId } = await this.service.authenticateUser({ email, password, userAgent: req.headers['user-agent'] });
      req.user = userId;
      setContextUserId(userId);

      if (req.platformType !== 'mobile') {
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict'
        });
        res.status(StatusCodes.OK).send({ accessToken });
        return;
      }
      res.status(StatusCodes.OK).send({ accessToken, refreshToken });
    } catch (error: unknown) {
      this.handleError(error, res);
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      setRequestContext({ ...this.context, methodName: 'refreshToken' });

      const currentRefreshToken = this.authorizationMiddleware.handleGetRefreshToken(req);

      if (currentRefreshToken === undefined) throw new ForbiddenError({ code: 'NO_REFRESH_TOKEN', message: 'refreshToken not found' });

      const { accessToken, refreshToken, userId } = await this.service.refreshToken({ refreshToken: currentRefreshToken, userAgent: req.headers['user-agent'] });
      req.user = userId;
      setContextUserId(userId);

      if (req.platformType !== 'mobile') {
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict'
        });
        res.status(StatusCodes.OK).send({ accessToken });
        return;
      }
      res.status(StatusCodes.OK).send({ accessToken, refreshToken });
    } catch (error: unknown) {
      this.handleError(error, res);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      setRequestContext({ ...this.context, methodName: 'logout' });
      const userId = this.authorizationMiddleware.handleUserId(req);

      const refreshToken = this.authorizationMiddleware.handleGetRefreshToken(req);

      await this.service.logout({ userId, refreshToken });

      if (req.platformType !== 'mobile') {
        res.cookie('refreshToken', '', {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          expires: new Date(0),
          path: '/'
        });
      }

      res.sendStatus(StatusCodes.NO_CONTENT);

    } catch (error) {
      this.handleError(error, res);
    }
  }

  async logoutFromAllDevices(req: Request, res: Response): Promise<void> {
    try {
      setRequestContext({ ...this.context, methodName: 'logoutFromAllDevices' });
      const userId = this.authorizationMiddleware.handleUserId(req);

      await this.service.logoutFromAllDevices({ userId });

      if (req.platformType !== 'mobile') {
        res.cookie('refreshToken', '', {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          expires: new Date(0),
          path: '/'
        });
      }

      res.sendStatus(StatusCodes.NO_CONTENT);

    } catch (error) {
      this.handleError(error, res);
    }
  }
}

export default AuthController;
