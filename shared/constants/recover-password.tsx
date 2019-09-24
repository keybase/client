import * as I from 'immutable'
import * as Types from './types/recover-password'
import HiddenString from '../util/hidden-string'

export const waitingKey = 'recover-password:waiting'
export const getPaperKeyOrPwWaitingKey = 'recover-password:submitPassword' // TODO Y2K-697 use this

export const makeState = I.Record<Types._State>({
  devices: I.List(),
  error: new HiddenString(''),
  explainedDevice: undefined,
  paperKeyError: new HiddenString(''),
  passwordError: new HiddenString(''),
  username: '',
})
