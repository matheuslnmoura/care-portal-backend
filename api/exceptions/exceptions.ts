import { StatusCodes } from 'http-status-codes';

interface ErrorInfoType {
  statusCode: number
  message: string
  code?: string
}

class CustomRequestError extends Error {
  public statusCode: ErrorInfoType['statusCode'];
  public code?: Required<ErrorInfoType>['code'];

  constructor({ message, statusCode, code }: ErrorInfoType) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class BadRequestError extends CustomRequestError {
  constructor({ message, code }: Omit<ErrorInfoType, 'statusCode'>) {
    super({ code, message, statusCode: StatusCodes.BAD_REQUEST });
  }
}

class UnauthorizedError extends CustomRequestError {
  constructor({ message, code }: Omit<ErrorInfoType, 'statusCode'>) {
    super({ code, message, statusCode: StatusCodes.UNAUTHORIZED });
  }
}

class ForbiddenError extends CustomRequestError {
  constructor({ message, code }: Omit<ErrorInfoType, 'statusCode'>) {
    super({ code, message, statusCode: StatusCodes.FORBIDDEN });
  }
}

class NotFoundError extends CustomRequestError {
  constructor({ message, code }: Omit<ErrorInfoType, 'statusCode'>) {
    super({ code, message, statusCode: StatusCodes.NOT_FOUND });
  }
}

class ConflictError extends CustomRequestError {
  constructor({ message, code }: Omit<ErrorInfoType, 'statusCode'>) {
    super({ code, message, statusCode: StatusCodes.CONFLICT });
  }
}

class TooManyRequestsError extends CustomRequestError {
  constructor({ message, code }: Omit<ErrorInfoType, 'statusCode'>) {
    super({ code, message, statusCode: StatusCodes.TOO_MANY_REQUESTS });
  }
}

class UnexpectedError extends CustomRequestError {
  constructor({ message, code }: Omit<ErrorInfoType, 'statusCode'>) {
    super({ code, message, statusCode: StatusCodes.INTERNAL_SERVER_ERROR });
  }
}

class RefreshTokenNotFoundError extends Error {
  constructor(message = 'Refresh token not found.') {
    super(message);
    this.name = 'RefreshTokenNotFoundError';
  }
}

class RefreshTokenOwnershipError extends Error {
  constructor(message = 'Refresh token does not belong to the provided user.') {
    super(message);
    this.name = 'RefreshTokenOwnershipError';
  }
}

class RefreshTokenRevokedError extends Error {
  constructor(message = 'Refresh token has been revoked.') {
    super(message);
    this.name = 'RefreshTokenRevokedError';
  }
}

class RefreshTokenExpiredError extends Error {
  constructor(message = 'Refresh token has expired.') {
    super(message);
    this.name = 'RefreshTokenExpiredError';
  }
}

class DuplicateEmailError extends Error {
  constructor(message = 'Email is already registered.') {
    super(message);
    this.name = 'DuplicateEmailError';
  }
}

class DuplicatePhoneError extends Error {
  constructor(message = 'Phone number is already registered.') {
    super(message);
    this.name = 'DuplicatePhoneError';
  }
}

export { CustomRequestError, BadRequestError, NotFoundError, UnexpectedError, TooManyRequestsError, UnauthorizedError, ForbiddenError, ConflictError, RefreshTokenNotFoundError, RefreshTokenOwnershipError, RefreshTokenRevokedError, RefreshTokenExpiredError, DuplicateEmailError, DuplicatePhoneError };
