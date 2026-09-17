import type { Request, Response } from 'express';
import BaseClass from '../../base/base-class/base-class.js';
import StaffUserService from './service/staff-user-service.js';
import { NotFoundError } from '../../exceptions/exceptions.js';
import { StatusCodes } from 'http-status-codes';
import AuthorizationMiddleware from '../../middlewares/authorization-middlewares/authorization-middleware.js';
import { setRequestContext } from '../../utils/request-context/request-context.js';

class StaffUsersController extends BaseClass {
  private readonly service: StaffUserService;
  private readonly authorizationMiddleware: AuthorizationMiddleware;
  constructor() {
    super();
    this.service = new StaffUserService();
    this.authorizationMiddleware = new AuthorizationMiddleware();
    this.context = { className: 'StaffUsersController' };
  }

  async getUserInfo(req: Request, res: Response): Promise<void> {
    setRequestContext({ ...this.context, methodName: 'getUserInfo' });
    const userId = this.authorizationMiddleware.handleUserId(req);
    const user = await this.service.findById({ userId });

    if (user === null) throw new NotFoundError({ message: 'User information not found', code: 'USER_INFO_NOT_FOUND' });

    res.status(StatusCodes.OK).send({ name: user.name, contacts: user.contacts });
  }
}

export default StaffUsersController;
