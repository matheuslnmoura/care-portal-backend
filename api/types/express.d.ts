declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: string;
      platform?: string;
      platformType?: string;
    }
    interface Response {
      errorDetails?: unknown;
    }
  }
}

export {};