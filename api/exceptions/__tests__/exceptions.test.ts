import { describe, expect, it } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import {
  BadRequestError,
  ConflictError,
  CustomRequestError,
  ForbiddenError,
  NotFoundError,
  RefreshTokenExpiredError,
  RefreshTokenNotFoundError,
  RefreshTokenOwnershipError,
  RefreshTokenRevokedError,
  TooManyRequestsError,
  UnauthorizedError,
  UnexpectedError
} from '../exceptions.js';

describe('CustomRequestError', () => {
  it('sets message, statusCode and code from its constructor', () => {
    const error = new CustomRequestError({ message: 'Something went wrong', statusCode: 418, code: 'TEAPOT' });

    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('TEAPOT');
  });

  it('leaves code undefined when not provided', () => {
    const error = new CustomRequestError({ message: 'Something went wrong', statusCode: 418 });

    expect(error.code).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const error = new CustomRequestError({ message: 'Something went wrong', statusCode: 418 });

    expect(error).toBeInstanceOf(Error);
  });

  it('does not override the inherited "Error" name', () => {
    const error = new CustomRequestError({ message: 'Something went wrong', statusCode: 418 });

    expect(error.name).toBe('Error');
  });
});

describe('HTTP status error subclasses', () => {
  it.each([
    [ BadRequestError, StatusCodes.BAD_REQUEST ],
    [ UnauthorizedError, StatusCodes.UNAUTHORIZED ],
    [ ForbiddenError, StatusCodes.FORBIDDEN ],
    [ NotFoundError, StatusCodes.NOT_FOUND ],
    [ ConflictError, StatusCodes.CONFLICT ],
    [ TooManyRequestsError, StatusCodes.TOO_MANY_REQUESTS ],
    [ UnexpectedError, StatusCodes.INTERNAL_SERVER_ERROR ]
  ] as const)('%s sets statusCode to %i and passes through message/code', (ErrorClass, expectedStatusCode) => {
    const error = new ErrorClass({ message: 'It failed', code: 'SOME_CODE' });

    expect(error.statusCode).toBe(expectedStatusCode);
    expect(error.message).toBe('It failed');
    expect(error.code).toBe('SOME_CODE');
    expect(error).toBeInstanceOf(CustomRequestError);
    expect(error).toBeInstanceOf(Error);
  });

  it.each([
    [ BadRequestError, StatusCodes.BAD_REQUEST ],
    [ UnauthorizedError, StatusCodes.UNAUTHORIZED ],
    [ ForbiddenError, StatusCodes.FORBIDDEN ],
    [ NotFoundError, StatusCodes.NOT_FOUND ],
    [ ConflictError, StatusCodes.CONFLICT ],
    [ TooManyRequestsError, StatusCodes.TOO_MANY_REQUESTS ],
    [ UnexpectedError, StatusCodes.INTERNAL_SERVER_ERROR ]
  ] as const)('%s leaves code undefined when not provided', (ErrorClass, _expectedStatusCode) => {
    const error = new ErrorClass({ message: 'It failed' });

    expect(error.code).toBeUndefined();
  });
});

describe('refresh token errors', () => {
  it.each([
    [ RefreshTokenNotFoundError, 'RefreshTokenNotFoundError', 'Refresh token not found.' ],
    [ RefreshTokenOwnershipError, 'RefreshTokenOwnershipError', 'Refresh token does not belong to the provided user.' ],
    [ RefreshTokenRevokedError, 'RefreshTokenRevokedError', 'Refresh token has been revoked.' ],
    [ RefreshTokenExpiredError, 'RefreshTokenExpiredError', 'Refresh token has expired.' ]
  ] as const)('%s defaults to its own name and message when constructed with no arguments', (ErrorClass, expectedName, expectedMessage) => {
    const error = new ErrorClass();

    expect(error.name).toBe(expectedName);
    expect(error.message).toBe(expectedMessage);
  });

  it.each([
    RefreshTokenNotFoundError,
    RefreshTokenOwnershipError,
    RefreshTokenRevokedError,
    RefreshTokenExpiredError
  ] as const)('%s uses a custom message when provided', (ErrorClass) => {
    const error = new ErrorClass('custom message');

    expect(error.message).toBe('custom message');
  });

  it.each([
    RefreshTokenNotFoundError,
    RefreshTokenOwnershipError,
    RefreshTokenRevokedError,
    RefreshTokenExpiredError
  ] as const)('%s is an Error but not a CustomRequestError', (ErrorClass) => {
    const error = new ErrorClass();

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(CustomRequestError);
  });
});
