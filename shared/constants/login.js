// @flow
import * as I from 'immutable'
import * as Types from './types/login'
import HiddenString from '../util/hidden-string'

export const waitingKey = 'login:waiting'

const makeAccount: I.RecordFactory<Types._Account> = I.Record({
  hasStoredSecret: false,
  username: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  codePageOtherDeviceName: '',
  codePageOtherDeviceType: 'phone',
  codePageTextCode: new HiddenString(''),
  codePageTextCodeError: '',
  configuredAccounts: I.List(),
  devicenameError: '',
  forgotPasswordError: null,
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  justDeletedSelf: null,
  justRevokedSelf: null,
  loginError: '',
  provisionUsernameOrEmail: '',
  registerUserPassError: null,
  registerUserPassLoading: false,
})

export {makeState, makeAccount}
