/* eslint-disable no-console */
import type { Request, Response  } from 'express';
import type { ConfigType } from '../environment-config/config.types.js';
import type { AuditInterface, RequestAuditInterface, ResponseAuditInterface } from '../../models/audit-model.js';
import { getRequestId, getUserId } from '../../utils/request-context/request-context.js';

interface LoggerInterface extends Omit<AuditInterface, 'req' | 'res' | 'role' | 'actor'> {
  role?: Pick<AuditInterface, 'role'>['role']
  actor?: Pick<AuditInterface, 'actor'>['actor']
  req?: Request,
  res?: Response
} ;

interface WriteOnConsoleInterface extends Pick<AuditInterface, 'type' | 'logMessage'> {
  logInfo: string;
  metadata?: Required<Pick<LoggerInterface, 'metadata'>>['metadata'];
  requestInfo?: RequestAuditInterface;
  responseInfo?: ResponseAuditInterface;
};

class Logger {
  private readonly env: string;
  private readonly config: ConfigType;

  constructor({ env, config }: { env: string; config: ConfigType }) {
    this.env = env;
    this.config = config;
  }

  private getLogInfo({ actor, role, className, method }: Pick<AuditInterface, 'actor' | 'role' | 'className' | 'method'  >): string {
    const requestId = getRequestId();
    const requestIdText = requestId !== undefined ? `requestId: [${requestId}] | ` : '';
    return `${requestIdText}env: [${this.env}] | role: [${role}] | actor: [${actor}] | className: [${className}] | method: [${method}]`;
  }

  private sanitizeBody({ body }: { body: Record<string, unknown> }): Record<string, unknown> {    const sanitizedBody = { ...body };
    if (typeof sanitizedBody.password === 'string') {
      sanitizedBody.password = 'redacted';
    }

    if (typeof sanitizedBody.passwordHash === 'string') {
      sanitizedBody.passwordHash = 'redacted';
    }

    return sanitizedBody;
  }

  private getRequestInfo({ req } : { req?: Request }): RequestAuditInterface | undefined {
    if (!req) return undefined;

    const sanitizedBody = (req.body !== null && req.body !== undefined) && typeof req.body === 'object'
      ? this.sanitizeBody({ body: req.body as Record<string, unknown> })
      : undefined;

    const requestInfo: RequestAuditInterface = {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      body: sanitizedBody,
      params: req.params,
      query: req.query
    };

    return requestInfo;
  }

  private getResponseInfo({ res, metadata } : { res?: Response, metadata?: object }): ResponseAuditInterface | undefined {
    if (!res) return;

    const responseInfo = {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: res.getHeaders(),
      body: metadata
    };

    return responseInfo;

  }

  private writeOnConsole({ type, logInfo, logMessage, metadata, requestInfo, responseInfo }: WriteOnConsoleInterface): void {
    console.log('----- \n');
    console.log(`${type.toUpperCase()} => ${logInfo}`);
    console.log(`Log => [${logMessage}]`);

    if (metadata) {
      console.log('-');
      console.log(`Metadata => [${JSON.stringify(metadata)}]`);
    }

    if (requestInfo) {
      console.log('-');
      console.log(`Request Info => [${JSON.stringify(requestInfo)}]`);
    }

    if (responseInfo) {
      console.log('-');
      console.log(`Response Info => [${JSON.stringify(responseInfo)}]`);
    }
  }

  private writeLog({
    type,
    actor = getUserId() ?? 'unknown',
    role = 'user',
    className,
    method,
    logMessage,
    metadata,
    req,
    res
  }: LoggerInterface): void {
    const logInfo = this.getLogInfo({ actor, role, className, method });
    const requestInfo = this.getRequestInfo({ req });
    const responseInfo = this.getResponseInfo({ res, metadata });

    if (this.config.log[type].console) {
      this.writeOnConsole({ type, logInfo, logMessage, metadata, requestInfo, responseInfo });
    }

    if (this.config.log[type].audit) {

    }
  }
  public info({ actor, role, className, method, logMessage, metadata, req, res }: Omit<LoggerInterface, 'type'>): void {
    this.writeLog({ type: 'info', actor, role, className, method, logMessage, metadata, req, res });
  }

  public warn({ actor, role, className, method, logMessage, metadata, req, res }: Omit<LoggerInterface, 'type'>): void {
    this.writeLog({ type: 'warn', actor, role, className, method, logMessage, metadata, req, res });
  }

  public error({ actor, role, className, method, logMessage, metadata, req, res }: Omit<LoggerInterface, 'type'>): void {
    this.writeLog({ type: 'error', actor, role, className, method, logMessage, metadata, req, res });
  }

  public success({ actor, role, className, method, logMessage, metadata, req, res }: Omit<LoggerInterface, 'type'>): void {
    this.writeLog({ type: 'success', actor, role, className, method, logMessage, metadata, req, res });
  }

  public fatal({ actor, role, className, method, logMessage, metadata, req, res }: Omit<LoggerInterface, 'type'>): void {
    this.writeLog({ type: 'fatal', actor, role, className, method, logMessage, metadata, req, res });
  }
}

export { Logger };
