import { describe, expect, it, vi } from 'vitest';

const { mockStaffUserService } = vi.hoisted(() => ({
  mockStaffUserService: {
    findById: vi.fn()
  }
}));

vi.mock('../../service/staff-user-service', () => ({
  default: vi.fn(function StaffUserServiceMock() {
    return mockStaffUserService;
  })
}));

import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import StaffUsersController from '../../controller.js';
import { UnexpectedError } from '../../../../exceptions/exceptions.js';
import type { StaffUserSchema } from '../../../../models/staff-user-model.js';
import { getRequestContext, requestContextStorage } from '../../../../utils/request-context/request-context.js';

interface MockResponse {
  errorDetails?: unknown;
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

const createMockRequest = (overrides: Record<string, unknown> = {}): Request => ({
  ...overrides
} as unknown as Request);

const createMockResponse = (): MockResponse => {
  const res: MockResponse = { status: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

const createUserFixture = (overrides: Partial<StaffUserSchema> = {}): StaffUserSchema => ({
  id: 'internal-uuid-1',
  userId: 'user-public-id-1',
  tenantId: 'tenant-id-1',
  name: 'Alice',
  contacts: { email: 'alice@example.com', phone: '+15551234567' },
  passwordHash: 'hashed-password',
  birthdate: new Date('1990-01-01'),
  status: 'active',
  profilePictureUrl: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  ...overrides
});

describe('StaffUsersController', () => {
  describe('getUserInfo', () => {
    const controller = new StaffUsersController();

    it('returns 401 when the request has no authenticated user', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getUserInfo(req, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(res.send).toHaveBeenCalledWith({ message: 'User Id not found', code: 'MISSING_USER_ID' });
      expect(mockStaffUserService.findById).not.toHaveBeenCalled();
    });

    it('returns 404 when the service finds no matching user', async () => {
      const req = createMockRequest({ user: 'user-public-id-1' });
      const res = createMockResponse();
      mockStaffUserService.findById.mockResolvedValueOnce(null);

      await controller.getUserInfo(req, res as unknown as Response);

      expect(mockStaffUserService.findById).toHaveBeenCalledWith({ userId: 'user-public-id-1' });
      expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(res.send).toHaveBeenCalledWith({ message: 'User information not found', code: 'USER_INFO_NOT_FOUND' });
    });

    it('returns only name and contacts when the user is found', async () => {
      const req = createMockRequest({ user: 'user-public-id-1' });
      const res = createMockResponse();
      const user = createUserFixture();
      mockStaffUserService.findById.mockResolvedValueOnce(user);

      await controller.getUserInfo(req, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.send).toHaveBeenCalledWith({ name: user.name, contacts: user.contacts });
    });

    it('does not leak fields beyond name and contacts to the response', async () => {
      const req = createMockRequest({ user: 'user-public-id-1' });
      const res = createMockResponse();
      mockStaffUserService.findById.mockResolvedValueOnce(createUserFixture());

      await controller.getUserInfo(req, res as unknown as Response);

      const sentBody = res.send.mock.calls[0][0] as Record<string, unknown>;
      expect(Object.keys(sentBody).sort()).toEqual([ 'contacts', 'name' ]);
    });

    it('delegates unexpected service errors to the shared error handler', async () => {
      const req = createMockRequest({ user: 'user-public-id-1' });
      const res = createMockResponse();
      mockStaffUserService.findById.mockRejectedValueOnce(
        new UnexpectedError({ message: 'An error occurred while getting user information.', code: 'GET_USER_ERROR' })
      );

      await controller.getUserInfo(req, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.send).toHaveBeenCalledWith({
        message: 'An error occurred while getting user information.',
        code: 'GET_USER_ERROR'
      });
    });

    it('sets the request context for logging purposes', async () => {
      const req = createMockRequest({ user: 'user-public-id-1' });
      const res = createMockResponse();
      mockStaffUserService.findById.mockResolvedValueOnce(createUserFixture());

      await requestContextStorage.run({ requestId: 'req-1' }, async () => {
        await controller.getUserInfo(req, res as unknown as Response);

        expect(getRequestContext()).toEqual({ className: 'StaffUsersController', methodName: 'getUserInfo' });
      });
    });
  });
});
