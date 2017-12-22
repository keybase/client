// @flow
import * as Types from './types/gregor'
import * as RPCTypes from './types/rpc-gen'

const initialState: Types.State = {
  reachability: {reachable: RPCTypes.reachabilityReachable.unknown},
  seenMsgs: {},
}

export {initialState}
