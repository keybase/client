import * as I from 'immutable'
import * as Types from './types/login'
import HiddenString from '../util/hidden-string'

// An ugly error message from the service that we'd like to rewrite ourselves.
export const invalidPasswordErrorString = 'Bad password: Invalid password. Server rejected login attempt..'

export const waitingKey = 'login:waiting'

export const makeState = I.Record<Types._State>({
  error: new HiddenString(''),
  forgotPasswordError: null,
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  registerUserPassLoading: false,
})
