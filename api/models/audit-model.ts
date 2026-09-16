// This model is excluded from coverage in vitest.config.ts because audit logging isn't
// implemented yet (Logger.writeLog's audit branch is a no-op, and Mongo is never connected).
// Remove that exclusion once this actually gets wired up and tested.
import type { Request } from 'express';
import type { OutgoingHttpHeaders } from 'http';
import { Schema, model, type Document } from 'mongoose';

interface RequestAuditInterface {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: Request['body'];
  params?: Record<string, string>;
  query?: Request['query'];
}

interface ResponseAuditInterface {
  statusCode: number;
  statusMessage?: string;
  headers?: OutgoingHttpHeaders;
  body?: Request['body'];
}

interface AuditInterface {
  type: 'info' | 'warn' | 'error' | 'success' | 'fatal';
  actor: string;
  role: string;
  className: string;
  method: string
  logMessage: string;
  metadata?: object
  req?: RequestAuditInterface
  res?: ResponseAuditInterface
}

type AuditModelInterface = {} & AuditInterface & Document;

const AuditSchema = new Schema<AuditModelInterface>({
  type: { type: String, required: true },
  actor: { type: String, required: true },
  role: { type: String, required: true },
  className: { type: String, required: true },
  method: { type: String, required: true },
  logMessage: { type: String, required: true },
  metadata: { type: Object },
  req: {
    method: { type: String },
    url: { type: String },
    headers: { type: Schema.Types.Mixed },
    body: { type: Schema.Types.Mixed },
    params: { type: Schema.Types.Mixed },
    query: { type: Schema.Types.Mixed }
  },
  res: {
    statusCode: { type: Number },
    statusMessage: { type: String },
    headers: { type: Schema.Types.Mixed },
    body: { type: Schema.Types.Mixed }
  }
}, {
  timestamps: true,
  collection: 'audit'
});

const AuditModel = model<AuditModelInterface>('Audit', AuditSchema);

export default AuditModel;
export type { AuditInterface, AuditModelInterface, RequestAuditInterface, ResponseAuditInterface };