import * as I from 'immutable'
import {_State} from './types/dev'

const makeState = I.Record<_State>({
  debugCount: 0,
  dumbFilter: '',
  dumbFullscreen: false,
  dumbIndex: 0,
})

export {makeState}
