import type { Request, Response } from 'express';
import BaseController from '../../base/base-controller/base-controller.js';
import UserService from './service/user-service.js';
import { NotFoundError } from '../../exceptions/exceptions.js';
import { StatusCodes } from 'http-status-codes';
import AuthorizationMiddleware from '../../middlewares/authorization-middlewares/authorization-middleware.js';
import { setRequestContext } from '../../utils/request-context/request-context.js';

class UsersController extends BaseController {
  private readonly service: UserService;
  private readonly authorizationMiddleware: AuthorizationMiddleware;
  constructor() {
    super();
    this.service = new UserService();
    this.authorizationMiddleware = new AuthorizationMiddleware();
    this.context = { className: 'UsersController' };
  }

  async getUserInfo(req: Request, res: Response): Promise<void> {
    try {
      setRequestContext({ ...this.context, methodName: 'getUserInfo' });
      const userId = this.authorizationMiddleware.handleUserId(req);
      const user = await this.service.findUserById({ userId });

      if (user === null) throw new NotFoundError({ message: 'User information not found', code: 'USER_INFO_NOT_FOUND' });

      res.status(StatusCodes.OK).send({ name: user.name, contacts: user.contacts });
    } catch (error: unknown) {
      this.handleError(error, res);
    }
  }
}

export default UsersController;