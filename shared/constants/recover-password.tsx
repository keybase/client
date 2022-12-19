import type * as Types from './types/recover-password'
import HiddenString from '../util/hidden-string'

export const waitingKey = 'recover-password:waiting'

export const makeState = (): Types.State => ({
  devices: [],
  error: new HiddenString(''),
  explainedDevice: undefined,
  paperKeyError: new HiddenString(''),
  passwordError: new HiddenString(''),
  resetEmailSent: false,
  username: '',
})
