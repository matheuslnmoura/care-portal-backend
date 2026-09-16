import { describe, expect, it } from 'vitest';
import { getRequestContext, getRequestId, getUserId, requestContextStorage, setContextUserId, setRequestContext } from '../request-context';

describe('requestContext', () => {
  it('returns undefined when called outside of any request context', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('returns the requestId set for the current context', () => {
    requestContextStorage.run({ requestId: 'req-1' }, () => {
      expect(getRequestId()).toBe('req-1');
    });
  });

  it('keeps the requestId available across an async boundary within the same run', async () => {
    await requestContextStorage.run({ requestId: 'req-2' }, async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(getRequestId()).toBe('req-2');
    });
  });

  it('does not leak the requestId outside of its run() callback', () => {
    requestContextStorage.run({ requestId: 'req-3' }, () => {});

    expect(getRequestId()).toBeUndefined();
  });

  it('keeps concurrent contexts isolated from each other across interleaved async work', async () => {
    const results: string[] = [];

    await Promise.all([
      requestContextStorage.run({ requestId: 'req-a' }, async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        results.push(getRequestId() as string);
      }),
      requestContextStorage.run({ requestId: 'req-b' }, async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        results.push(getRequestId() as string);
      })
    ]);

    expect(results).toContain('req-a');
    expect(results).toContain('req-b');
    expect(results[0]).not.toBe(results[1]);
  });

  describe('userId', () => {
    it('returns undefined when there is no active context', () => {
      expect(getUserId()).toBeUndefined();
    });

    it('returns undefined when a context is active but no userId was set', () => {
      requestContextStorage.run({ requestId: 'req-1' }, () => {
        expect(getUserId()).toBeUndefined();
      });
    });

    it('returns the userId set via setContextUserId within the same context', () => {
      requestContextStorage.run({ requestId: 'req-1' }, () => {
        setContextUserId('user-1');

        expect(getUserId()).toBe('user-1');
      });
    });

    it('does nothing when called outside of any active context', () => {
      expect(() => setContextUserId('user-1')).not.toThrow();
      expect(getUserId()).toBeUndefined();
    });

    it('does not leak a userId into a sibling context', () => {
      requestContextStorage.run({ requestId: 'req-a' }, () => {
        setContextUserId('user-a');
      });

      requestContextStorage.run({ requestId: 'req-b' }, () => {
        expect(getUserId()).toBeUndefined();
      });
    });
  });

  describe('requestContext (className/methodName)', () => {
    it('returns undefined fields when there is no active context', () => {
      expect(getRequestContext()).toEqual({ className: undefined, methodName: undefined });
    });

    it('returns undefined fields when a context is active but none were set', () => {
      requestContextStorage.run({ requestId: 'req-1' }, () => {
        expect(getRequestContext()).toEqual({ className: undefined, methodName: undefined });
      });
    });

    it('returns the className/methodName set via setRequestContext within the same context', () => {
      requestContextStorage.run({ requestId: 'req-1' }, () => {
        setRequestContext({ className: 'AuthController', methodName: 'login' });

        expect(getRequestContext()).toEqual({ className: 'AuthController', methodName: 'login' });
      });
    });

    it('overwrites the previous className/methodName on a later call within the same context', () => {
      requestContextStorage.run({ requestId: 'req-1' }, () => {
        setRequestContext({ className: 'AuthController', methodName: 'login' });
        setRequestContext({ className: 'AuthController', methodName: 'refreshToken' });

        expect(getRequestContext()).toEqual({ className: 'AuthController', methodName: 'refreshToken' });
      });
    });

    it('does nothing when called outside of any active context', () => {
      expect(() => setRequestContext({ className: 'AuthController', methodName: 'login' })).not.toThrow();
      expect(getRequestContext()).toEqual({ className: undefined, methodName: undefined });
    });

    it('does not leak className/methodName into a sibling context', () => {
      requestContextStorage.run({ requestId: 'req-a' }, () => {
        setRequestContext({ className: 'AuthController', methodName: 'login' });
      });

      requestContextStorage.run({ requestId: 'req-b' }, () => {
        expect(getRequestContext()).toEqual({ className: undefined, methodName: undefined });
      });
    });
  });
});
