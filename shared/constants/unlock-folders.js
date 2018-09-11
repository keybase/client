// @flow
import * as I from 'immutable'
import * as Types from './types/unlock-folders'

const makeDevice: I.RecordFactory<Types._Device> = I.Record({
  deviceID: '',
  name: '',
  type: 'mobile',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  devices: I.List(),
  paperkeyError: null,
  phase: 'dead',
  popupOpen: false,
  sessionID: null,
  waiting: false,
})

export {makeState, makeDevice}
