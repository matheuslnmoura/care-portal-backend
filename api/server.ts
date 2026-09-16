import './bootstrap-env';
import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import BaseClass from './base/base-class/base-class';
import UserRoutes from './modules/users/route';
import DatabaseManager from './config/database/database-manager';
import PlatformMiddleware from './middlewares/platform-middleware/platform-middleware';
import requestIdMiddleware from './middlewares/request-middlewares/request-id-middleware';
import requestLoggerMiddleware from './middlewares/request-middlewares/request-logger-middleware';
import responseLoggerMiddleware from './middlewares/request-middlewares/response-logger-middleware';
import AuthorizationMiddleware from './middlewares/authorization-middlewares/authorization-middleware';
import AuthRoutes from './modules/auth/route';

class Server extends BaseClass {
  private readonly app: Application;
  private readonly port: number;
  private readonly databaseManager: DatabaseManager;

  constructor() {
    super();
    this.app = express();
    this.port = this.config.app.port;
    this.databaseManager = new DatabaseManager({
      mongoConfig: this.config.db.mongodb,
      redisConfig: this.config.db.redis,
      postgresConfig: this.config.db.postgres
    });

    this.initializeMiddlewares();
    this.initializeRoutes();
  }

  private initializeMiddlewares(): void {
    const platformMiddleware = new PlatformMiddleware();
    const authorizationMiddleware = new AuthorizationMiddleware();

    this.app.use(cookieParser());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(platformMiddleware.middleware());
    this.app.use(requestIdMiddleware());
    this.app.use(requestLoggerMiddleware(this.logger));
    this.app.use(responseLoggerMiddleware(this.logger));
    this.app.use(authorizationMiddleware.verifyAccessToken());
  }

  private initializeRoutes(): void {
    const authRoute = new AuthRoutes();
    const userRoute = new UserRoutes();

    authRoute.authRoutes(this.app);
    userRoute.userRoutes(this.app);

    this.app.get('/', (req, res) => {
      res.send(`${this.config.app.name} is running in ${this.env} environment`);
    });
  }

  public async start(): Promise<void> {
    try {
      await this.databaseManager.connectAll();
      this.app.listen(this.port, () => {
        this.logger.success({
          actor: 'system',
          role: 'server',
          className: 'server',
          method: 'start',
          logMessage: `Server is running on port ${this.port} in ${this.env} environment`
        });
      });
    } catch (error: unknown) {
      this.logger.error({
        actor: 'system',
        role: 'server',
        className: 'server',
        method: 'start',
        logMessage: 'Failed to start server due to database connection errors',
        metadata: { error }
      });
    }
  }
}

const server = new Server();
server.start()
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', error);
  });