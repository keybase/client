// @flow
import type {_State} from './types/route-tree'
import * as I from 'immutable'

export const makeState: I.RecordFactory<_State> = I.Record({
  loggedInUserNavigated: false,
  routeDef: null,
  routeState: null,
})
