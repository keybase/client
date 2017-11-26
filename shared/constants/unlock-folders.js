// @flow
import type {State} from './types/unlock-folders'

const initialState: State = {
  closed: true,
  devices: null,
  paperkeyError: null,
  phase: 'dead',
  sessionID: null,
  waiting: false,
}

export {initialState}
