// @flow
import type {State} from './types/dev'

export const initialState: State = {
  debugConfig: {
    dumbFilter: '',
    dumbFullscreen: false,
    dumbIndex: 0,
  },
  debugCount: 0,
  hmrReloading: false,
}
