import type { Application } from 'express';
import StaffUsersController from './controller.js';
import BaseRoute from '../../base/base-route/base-route.js';

class StaffUserRoutes extends BaseRoute {
  controller: StaffUsersController;

  constructor() {
    super();
    this.controller = new StaffUsersController();
  }

  staffUserRoutes(app: Application): void {
    const basePath = this.getBasePath('/staff-users');

    app.get(`${basePath}/user-info`, this.controller.getUserInfo.bind(this.controller));
  }
}

export default StaffUserRoutes;
