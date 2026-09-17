import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../../__tests__/__integration__/setup/app.js';
import { seedStaffUser, truncateAll } from '../../../../__tests__/__integration__/setup/db-fixtures.js';
import { TokenManager } from '../../../../utils/token-manager/token-manager.js';

const app = createApp();
const tokenManager = new TokenManager();

describe('GET /api/staff-users/user-info', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('returns the authenticated user\'s name and contacts', async () => {
    const staffUser = await seedStaffUser({ name: 'Alice Provider', email: 'alice@example.com' });
    const accessToken = tokenManager.generateAccessToken({ payload: { userId: staffUser.publicId } });

    const response = await request(app)
      .get('/api/staff-users/user-info')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      name: 'Alice Provider',
      contacts: { email: 'alice@example.com', phone: expect.any(String) as string }
    });
  });

  it('returns 404 when the token is validly signed but no matching staff user exists', async () => {
    const accessToken = tokenManager.generateAccessToken({ payload: { userId: 'no-such-public-id' } });

    const response = await request(app)
      .get('/api/staff-users/user-info')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'USER_INFO_NOT_FOUND' });
  });
});
