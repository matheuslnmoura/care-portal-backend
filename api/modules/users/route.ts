import type { Application } from 'express';
import UsersController from './controller';
import BaseRoute from '../../base/base-route/base-route';

class UserRoutes extends BaseRoute {
  controller: UsersController;

  constructor() {
    super();
    this.controller = new UsersController();
  }

  userRoutes(app: Application): void {
    const basePath = this.getBasePath('/users');

    app.get(`${basePath}/user-info`, this.controller.getUserInfo.bind(this.controller));
  }
}

export default UserRoutes;