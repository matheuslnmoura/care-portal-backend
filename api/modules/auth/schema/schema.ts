import Joi from 'joi';
import type { StaffUserSchema } from '../../../models/staff-user-model.js';

export interface SignUpBodyInterface {
  name: StaffUserSchema['name'];
  email: StaffUserSchema['contacts']['email'];
  password: string;
  phone: StaffUserSchema['contacts']['phone'];
  birthdate: StaffUserSchema['birthdate'];
  // The tenant (clinic/hospital) this staff account is being created under - must already exist.
  // No tenant-selection/onboarding flow exists yet (Phase 1), so the client is assumed to already
  // know which tenant it's registering for.
  tenantId: StaffUserSchema['tenantId'];
}

export const signUpBodySchema: Joi.ObjectSchema<SignUpBodyInterface> = Joi.object<SignUpBodyInterface>({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  phone: Joi.string().required(),
  birthdate: Joi.date().required(),
  tenantId: Joi.string().guid().required()
});

export interface LoginBodyInterface extends Pick<SignUpBodyInterface, 'email'| 'password'> {}

export const loginBodySchema: Joi.ObjectSchema<LoginBodyInterface> = Joi.object<LoginBodyInterface>({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

