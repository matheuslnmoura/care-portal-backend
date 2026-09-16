import Joi from 'joi';
import type { UserSchema } from '../../../models/user-model.js';

export interface SignUpBodyInterface {
  name: UserSchema['name'];
  email: UserSchema['contacts']['email'];
  password: string;
  phone: UserSchema['contacts']['phone'];
  birthdate: UserSchema['birthdate'];
}

export const signUpBodySchema: Joi.ObjectSchema<SignUpBodyInterface> = Joi.object<SignUpBodyInterface>({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  phone: Joi.string().required(),
  birthdate: Joi.date().required()
});

export interface LoginBodyInterface extends Pick<SignUpBodyInterface, 'email'| 'password'> {}

export const loginBodySchema: Joi.ObjectSchema<LoginBodyInterface> = Joi.object<LoginBodyInterface>({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

