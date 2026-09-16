import { describe, expect, it } from 'vitest';
import { loginBodySchema, signUpBodySchema } from '../schema';

const omitField = (payload: Record<string, unknown>, field: string): Record<string, unknown> => {
  const clone = { ...payload };
  delete clone[field];
  return clone;
};

describe('signUpBodySchema', () => {
  const validPayload = {
    name: 'Alice',
    email: 'alice@example.com',
    password: 'super-secret',
    phone: '+15551234567',
    birthdate: '1990-01-01'
  };

  it('accepts a valid payload', () => {
    const { error } = signUpBodySchema.validate(validPayload);

    expect(error).toBeUndefined();
  });

  it.each([ 'name', 'email', 'password', 'phone', 'birthdate' ])('rejects a payload missing %s', (field) => {
    const { error } = signUpBodySchema.validate(omitField(validPayload, field));

    expect(error).toBeDefined();
  });

  it('rejects an invalid email format', () => {
    const { error } = signUpBodySchema.validate({ ...validPayload, email: 'not-an-email' });

    expect(error).toBeDefined();
  });

  it('rejects a value that cannot be parsed as a date for birthdate', () => {
    const { error } = signUpBodySchema.validate({ ...validPayload, birthdate: 'not-a-date' });

    expect(error).toBeDefined();
  });

  it('rejects an unrecognized extra field', () => {
    const { error } = signUpBodySchema.validate({ ...validPayload, isAdmin: true });

    expect(error).toBeDefined();
  });
});

describe('loginBodySchema', () => {
  const validPayload = { email: 'alice@example.com', password: 'super-secret' };

  it('accepts a valid payload', () => {
    const { error } = loginBodySchema.validate(validPayload);

    expect(error).toBeUndefined();
  });

  it.each([ 'email', 'password' ])('rejects a payload missing %s', (field) => {
    const { error } = loginBodySchema.validate(omitField(validPayload, field));

    expect(error).toBeDefined();
  });

  it('rejects an invalid email format', () => {
    const { error } = loginBodySchema.validate({ ...validPayload, email: 'not-an-email' });

    expect(error).toBeDefined();
  });
});
