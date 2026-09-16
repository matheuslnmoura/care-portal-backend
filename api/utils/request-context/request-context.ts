import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
  className?: string;
  methodName?: string;
}

export interface RequestContextFields {
  className?: Required<RequestContext>['className'];
  methodName?: Required<RequestContext>['methodName'];
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const getRequestId = (): RequestContext['requestId'] | undefined => requestContextStorage.getStore()?.requestId;

export const getUserId = (): RequestContext['userId'] | undefined => requestContextStorage.getStore()?.userId;

export const setContextUserId = (userId: RequestContext['userId']): void => {
  const store = requestContextStorage.getStore();

  if (store !== undefined) {
    store.userId = userId;
  }
};

export const setRequestContext = ({ className, methodName }: RequestContextFields): void => {
  const store = requestContextStorage.getStore();

  if (store !== undefined) {
    store.className = className;
    store.methodName = methodName;
  }
};

export const getRequestContext = (): RequestContextFields => {
  const store = requestContextStorage.getStore();

  return { className: store?.className, methodName: store?.methodName };
};
