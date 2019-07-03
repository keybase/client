import * as I from 'immutable'
import * as Types from './types/gregor'
import * as RPCTypes from './types/rpc-gen'

export const makeState = I.Record<Types._State>({
  reachable: RPCTypes.Reachable.unknown,
})
