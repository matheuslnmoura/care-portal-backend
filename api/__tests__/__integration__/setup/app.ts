import type { Application } from 'express';
import Server from '../../../server.js';

// A fresh Server/app per call - cheap (no real I/O happens in the constructor itself, only
// route/middleware wiring), and keeps tests from accidentally sharing app-level state.
export const createApp = (): Application => new Server().getApp();
