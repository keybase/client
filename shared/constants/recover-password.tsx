import * as I from 'immutable'
import * as Types from './types/recover-password'
import HiddenString from '../util/hidden-string'

export const waitingKey = 'recover-password:waiting'

export const makeState = I.Record<Types._State>({
  deviceName: '',
  devices: I.List(),
  error: new HiddenString(''),
  username: '',
})
