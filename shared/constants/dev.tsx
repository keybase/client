import * as I from 'immutable'
import { _State } from './types/dev';

const makeState: I.Record.Factory<_State> = I.Record({
  debugCount: 0,
  dumbFilter: '',
  dumbFullscreen: false,
  dumbIndex: 0,
})

export {makeState}
