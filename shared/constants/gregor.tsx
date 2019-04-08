import * as I from 'immutable'
import * as Types from './types/gregor'
import * as RPCTypes from './types/rpc-gen'

export const makeState: I.Record.Factory<Types._State> = I.Record({
  reachable: RPCTypes.reachabilityReachable.unknown,
})
