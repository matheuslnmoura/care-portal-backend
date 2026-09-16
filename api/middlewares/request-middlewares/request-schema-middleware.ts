import type { Request, Response, NextFunction } from 'express';
import type Joi from 'joi';
import { BadRequestError, CustomRequestError } from '../../exceptions/exceptions.js';
import BaseClass from '../../base/base-class/base-class.js';
import { StatusCodes } from 'http-status-codes';
import { setRequestContext } from '../../utils/request-context/request-context.js';

interface RequestSchemaInterface<BodySchemaInterface = unknown, HeaderSchemaInterface = unknown> {
  bodySchema?: Joi.ObjectSchema<BodySchemaInterface>;
  headerSchema?: Joi.ObjectSchema<HeaderSchemaInterface>;
}

class RequestSchemaMiddleware<BodySchemaInterface = unknown, HeaderSchemaInterface = unknown> extends BaseClass {
  private readonly bodySchema?: Joi.ObjectSchema<BodySchemaInterface>;
  private readonly headerSchema?: Joi.ObjectSchema<HeaderSchemaInterface>;

  constructor({ bodySchema, headerSchema }: RequestSchemaInterface<BodySchemaInterface, HeaderSchemaInterface>) {
    super();
    this.bodySchema = bodySchema;
    this.headerSchema = headerSchema;
    this.context = { className: 'RequestSchemaMiddleware' };
  }

  public validate = () => (req: Request, res: Response, next: NextFunction): void => {
    try {
      setRequestContext({ ...this.context, methodName: 'validate' });
      if (this.headerSchema) {
        const { error: headerError } = this.headerSchema.validate(req.headers, { abortEarly: true });
        if (headerError) {
          throw new BadRequestError({ message: headerError.message, code: 'BAD_REQUEST' });
        }
      }

      if (this.bodySchema) {
        const { error: bodyError } = this.bodySchema.validate(req.body, { abortEarly: true });
        if (bodyError) {
          throw new BadRequestError({ message: bodyError.message, code: 'BAD_REQUEST' });
        }
      }

      next();
    } catch (error: unknown) {
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
  };
}

export default RequestSchemaMiddleware;
