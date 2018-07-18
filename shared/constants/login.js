// @flow
import * as I from 'immutable'
import * as Types from './types/login'
import HiddenString from '../util/hidden-string'

export const waitingKey = 'login:waiting'

export const makeAccount: I.RecordFactory<Types._Account> = I.Record({
  hasStoredSecret: false,
  username: '',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  configuredAccounts: I.List(),
  error: new HiddenString(''),
  forgotPasswordError: null,
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  justDeletedSelf: null,
  justRevokedSelf: null,
  registerUserPassLoading: false,
})
