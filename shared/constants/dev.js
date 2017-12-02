// @flow
import * as I from 'immutable'
import type {_State} from './types/dev'

const makeState: I.RecordFactory<_State> = I.Record({
  debugCount: 0,
  dumbFilter: '',
  dumbFullscreen: false,
  dumbIndex: 0,
})

export {makeState}
