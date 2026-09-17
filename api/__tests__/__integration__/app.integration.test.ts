import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './setup/app.js';

const app = createApp();

describe('GET /', () => {
  // Not listed in config.application.publicRoutes, so it goes through AuthorizationMiddleware
  // like every other route - confirmed by hand against the real running server before writing
  // this. Worth knowing: this means the root route is not actually reachable without a valid
  // access token today, which is likely not the intent for a plain liveness/landing route.
  it('returns 412 without an Authorization header, same as any other non-public route', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(412);
    expect(response.body).toMatchObject({ code: 'NO_AUTH_HEADER' });
  });
});
