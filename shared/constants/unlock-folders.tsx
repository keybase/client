import * as I from 'immutable'
import * as Types from './types/unlock-folders'

const makeDevice = I.Record<Types._Device>({
  deviceID: '',
  name: '',
  type: 'mobile',
})

const makeState = I.Record<Types._State>({
  devices: I.List(),
  paperkeyError: null,
  phase: 'dead',
  popupOpen: false,
  sessionID: null,
  waiting: false,
})

export {makeState, makeDevice}
