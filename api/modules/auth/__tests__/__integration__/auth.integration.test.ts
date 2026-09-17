import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../../__tests__/__integration__/setup/app.js';
import { seedStaffUser, seedTenant, truncateAll } from '../../../../__tests__/__integration__/setup/db-fixtures.js';

const app = createApp();

describe('auth routes', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  describe('POST /api/auth/signup', () => {
    it('returns 400 for a request missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('creates a staff user under the given tenant and returns 200 with only the public fields', async () => {
      const tenant = await seedTenant();

      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Alice Provider',
          email: 'alice@example.com',
          password: 'super-secret',
          phone: '+15551234567',
          birthdate: '1990-01-01',
          tenantId: tenant.id
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        userId: expect.any(String) as string,
        name: 'Alice Provider',
        email: 'alice@example.com',
        phone: '+15551234567'
      });
    });

    it('returns 409 when the email is already registered', async () => {
      const existing = await seedStaffUser({ email: 'taken@example.com' });
      const tenant = await seedTenant();

      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Someone Else',
          email: existing.email,
          password: 'super-secret',
          phone: '+15559999999',
          birthdate: '1990-01-01',
          tenantId: tenant.id
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
    });

    it('returns 404 when tenantId does not reference an existing tenant', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Alice Provider',
          email: 'alice@example.com',
          password: 'super-secret',
          phone: '+15551234567',
          birthdate: '1990-01-01',
          tenantId: '00000000-0000-0000-0000-000000000000'
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'TENANT_NOT_FOUND' });
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns an access token and sets a refresh-token cookie on valid credentials', async () => {
      const staffUser = await seedStaffUser({ email: 'login-success@example.com', password: 'correct-password' });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: staffUser.email, password: 'correct-password' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).not.toHaveProperty('refreshToken');
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((cookie) => cookie.startsWith('refreshToken='))).toBe(true);
    });

    it('returns 401 for a correct email with the wrong password', async () => {
      const staffUser = await seedStaffUser({ email: 'wrong-password@example.com', password: 'correct-password' });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: staffUser.email, password: 'not-the-password' });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('returns 401 for an email that does not exist', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever' });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
  });

  describe('POST /api/auth/refresh', () => {
    const loginAndGetRefreshCookie = async (email: string, password: string): Promise<string> => {
      const loginResponse = await request(app).post('/api/auth/login').send({ email, password });
      const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
      const refreshCookie = cookies.find((cookie) => cookie.startsWith('refreshToken='));
      if (refreshCookie === undefined) throw new Error('Login did not set a refreshToken cookie');
      return refreshCookie.split(';')[0];
    };

    it('returns 403 when no refresh token is present', async () => {
      const response = await request(app).post('/api/auth/refresh');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'NO_REFRESH_TOKEN' });
    });

    it('returns 401 for a malformed refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=not-a-real-token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });

    it('returns 403 when the refresh token cookie is an empty string', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'NO_REFRESH_TOKEN' });
    });

    it('rotates the refresh token and returns a new access token on success', async () => {
      const staffUser = await seedStaffUser({ email: 'refresh-success@example.com', password: 'correct-password' });
      const refreshCookie = await loginAndGetRefreshCookie(staffUser.email, 'correct-password');

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });

    it('returns 401 when a refresh token is reused after being rotated', async () => {
      const staffUser = await seedStaffUser({ email: 'refresh-reuse@example.com', password: 'correct-password' });
      const refreshCookie = await loginAndGetRefreshCookie(staffUser.email, 'correct-password');

      await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
      const secondAttempt = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);

      expect(secondAttempt.status).toBe(401);
      expect(secondAttempt.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });

    it('returns 401 after the refresh token has been revoked by logout', async () => {
      const staffUser = await seedStaffUser({ email: 'refresh-after-logout@example.com', password: 'correct-password' });
      const loginResponse = await request(app).post('/api/auth/login').send({ email: staffUser.email, password: 'correct-password' });
      const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
      const refreshCookie = (cookies.find((cookie) => cookie.startsWith('refreshToken=')) ?? '').split(';')[0];
      const accessToken = (loginResponse.body as { accessToken: string }).accessToken;

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshCookie);

      const response = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the refresh-token cookie and returns 204 for an authenticated user', async () => {
      const staffUser = await seedStaffUser({ email: 'logout-success@example.com', password: 'correct-password' });
      const loginResponse = await request(app).post('/api/auth/login').send({ email: staffUser.email, password: 'correct-password' });
      const accessToken = (loginResponse.body as { accessToken: string }).accessToken;

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(204);
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((cookie) => cookie.startsWith('refreshToken=;'))).toBe(true);
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('revokes every refresh token for the user and returns 204', async () => {
      const staffUser = await seedStaffUser({ email: 'logout-all-success@example.com', password: 'correct-password' });
      const loginResponse = await request(app).post('/api/auth/login').send({ email: staffUser.email, password: 'correct-password' });
      const accessToken = (loginResponse.body as { accessToken: string }).accessToken;
      const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
      const refreshCookie = (cookies.find((cookie) => cookie.startsWith('refreshToken=')) ?? '').split(';')[0];

      const logoutAllResponse = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutAllResponse.status).toBe(204);

      const refreshAfter = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
      expect(refreshAfter.status).toBe(401);
    });
  });
});
