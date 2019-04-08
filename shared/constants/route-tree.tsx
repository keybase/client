import { _State } from './types/route-tree';
import * as I from 'immutable'

export const makeState: I.Record.Factory<_State> = I.Record({
  loggedInUserNavigated: false,
  previousTab: null,
  routeDef: null,
  routeState: null,
})
