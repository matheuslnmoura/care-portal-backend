import type { Application } from 'express';
import AuthController from './controller.js';
import BaseRoute from '../../base/base-route/base-route.js';
import RequestSchemaMiddleware from '../../middlewares/request-middlewares/request-schema-middleware.js';
import { loginBodySchema, signUpBodySchema } from './schema/schema.js';

class AuthRoutes extends BaseRoute {
  controller: AuthController;

  constructor() {
    super();
    this.controller = new AuthController();
  }

  authRoutes(app: Application): void {
    const basePath = this.getBasePath('/auth');

    app.post(`${basePath}/signup`,
      new RequestSchemaMiddleware({ bodySchema: signUpBodySchema }).validate(),
      this.controller.signUp.bind(this.controller)
    );

    app.post(`${basePath}/login`,
      new RequestSchemaMiddleware({ bodySchema: loginBodySchema }).validate(),
      this.controller.login.bind(this.controller)
    );

    app.post(`${basePath}/refresh`, this.controller.refreshToken.bind(this.controller));

    app.post(`${basePath}/logout`, this.controller.logout.bind(this.controller));

    app.post(`${basePath}/logout-all`, this.controller.logoutFromAllDevices.bind(this.controller));
  }
}

export default AuthRoutes;