import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../../__tests__/__integration__/setup/app.js';

const app = createApp();

// These exercise AuthorizationMiddleware.verifyAccessToken() over real HTTP against any
// non-public route - GET /api/staff-users/user-info stands in for "any protected route" here,
// since the middleware runs identically ahead of all of them.
describe('AuthorizationMiddleware, exercised over real HTTP', () => {
  it('returns 412 when no Authorization header is present', async () => {
    const response = await request(app).get('/api/staff-users/user-info');

    expect(response.status).toBe(412);
    expect(response.body).toMatchObject({ code: 'NO_AUTH_HEADER' });
  });

  it('returns 412 when the Authorization scheme is not Bearer', async () => {
    const response = await request(app)
      .get('/api/staff-users/user-info')
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(response.status).toBe(412);
    expect(response.body).toMatchObject({ code: 'INVALID_AUTH_HEADER_TYPE' });
  });

  it('returns 500 for a token with an invalid signature, via the centralized error handler', async () => {
    const response = await request(app)
      .get('/api/staff-users/user-info')
      .set('Authorization', 'Bearer not-a-real.jwt.token');

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });
});
