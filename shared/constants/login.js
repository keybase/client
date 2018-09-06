// @flow
import * as I from 'immutable'
import * as Types from './types/login'
import HiddenString from '../util/hidden-string'

export const waitingKey = 'login:waiting'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  error: new HiddenString(''),
  forgotPasswordError: null,
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  justDeletedSelf: null,
  justRevokedSelf: null,
  registerUserPassLoading: false,
})
