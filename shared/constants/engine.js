// @flow
import * as I from 'immutable'
import type {NoErrorTypedAction} from './types/flux'

export type ErrorInRpc = NoErrorTypedAction<'engine:errorInRpc', {error: Error}>
export type WaitingForRpc = NoErrorTypedAction<'engine:waitingForRpc', {waiting: boolean, rpcName: string}>

export type Actions = ErrorInRpc | WaitingForRpc

type _State = {
  rpcWaitingStates: Map<string, boolean>,
}
export type State = I.RecordOf<_State>
export const makeState: I.RecordFactory<_State> = I.Record({
  rpcWaitingStates: Map(),
})
