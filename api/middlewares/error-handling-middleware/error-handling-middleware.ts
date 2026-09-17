import type { ErrorRequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import BaseClass from '../../base/base-class/base-class.js';
import { CustomRequestError } from '../../exceptions/exceptions.js';

class ErrorHandlingMiddleware extends BaseClass {
  handle(): ErrorRequestHandler {
    return (error, _req, res, _next): void => {
      res.errorDetails = error;
      let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      let message = 'An unexpected error occurred.';
      let code: string | undefined = 'INTERNAL_SERVER_ERROR';

      if (error instanceof CustomRequestError) {
        statusCode = error.statusCode;
        message = error.message;
        code = error.code;
      }

      res.status(statusCode).send({ message, code });
    };
  }
}

export default ErrorHandlingMiddleware;
