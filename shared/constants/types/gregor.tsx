import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'

export type _State = {
  reachable: RPCTypes.Reachable
}

export type State = I.RecordOf<_State>
