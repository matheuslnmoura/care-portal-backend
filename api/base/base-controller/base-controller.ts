import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import BaseClass from '../base-class/base-class';
import { CustomRequestError } from '../../exceptions/exceptions';

class BaseController extends BaseClass {
  protected handleError(error: unknown, res: Response): void {
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
  }
}

export default BaseController;
