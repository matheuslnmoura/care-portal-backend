import type { Request, Response } from 'express';
import BaseController from '../../base/base-controller/base-controller';
import UserService from './service/user-service';
import { NotFoundError } from '../../exceptions/exceptions';
import { StatusCodes } from 'http-status-codes';
import AuthorizationMiddleware from '../../middlewares/authorization-middlewares/authorization-middleware';
import { setRequestContext } from '../../utils/request-context/request-context';

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