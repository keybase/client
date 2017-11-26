// @flow
import * as I from 'immutable'
import * as FluxTypes from './flux'

export type Finished = FluxTypes.NoErrorTypedAction<
  '@@engineRPCCall:finished',
  {
    error: ?any,
    params: ?any,
  }
>

export type RpcRunResult = Finished | FluxTypes.NoErrorTypedAction<'@@engineRPCCall:bailedEarly', void>
export type _State = {
  rpcWaitingStates: I.Map<string, boolean>,
}

export type State = I.RecordOf<_State>
