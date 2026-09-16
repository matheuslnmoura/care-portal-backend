import type { Request, Response, NextFunction } from 'express';
import type { Logger } from '../../config/logger/logger.js';
import { CustomRequestError } from '../../exceptions/exceptions.js';
import { getRequestContext } from '../../utils/request-context/request-context.js';

interface ErrorObjectInterface {
  customRequestError: boolean;
  message: string;
  name: string;
  statusCode?: number;
  code?: string
}

const responseLoggerMiddleware = (logger: Logger) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 'finish' fires exactly once per response, regardless of whether the handler used
    // res.send/res.json/res.end, so there's no need to patch res.send and guard against
    // double-logging (Express's res.send itself re-enters via res.json for object bodies).
    res.on('finish', () => {
      const { className, methodName } = getRequestContext();

      const loggerParams = {
        actor: req.user ?? 'unknown',
        className: className ?? 'Middleware',
        method: methodName ?? 'responseLoggerMiddleware',
        logMessage: `Outgoing response: ${res.statusCode} for ${req.method} ${req.originalUrl}`,
        res
      };

      const error = res.errorDetails;

      if (error !== undefined && error !== null) {
        const errorObj = handleErrorTypes(error);
        logger.error({
          ...loggerParams,
          metadata: {
            error: errorObj
          }
        });
      } else {
        logger.success({
          ...loggerParams,
          metadata: {
            statusCode: res.statusCode,
            headers: res.getHeaders()
          }
        });
      }
    });

    next();
  };
};

const handleErrorTypes = (error: {}): {} => {
  if (error instanceof Error) {
    const errorObject: ErrorObjectInterface = {
      customRequestError: false,
      message: error.message,
      name: error.name
    };

    if (error instanceof CustomRequestError) {
      errorObject.customRequestError = true;
      errorObject.statusCode = error.statusCode;
      errorObject.code = error.code;
    }

    return errorObject;
  }

  return error;

};

export default responseLoggerMiddleware;
