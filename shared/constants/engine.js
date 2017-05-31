// @flow
import {Map, Record} from 'immutable'
import type {NoErrorTypedAction} from './types/flux'

export type ErrorInRpc = NoErrorTypedAction<'engine:errorInRpc', {error: Error}>
export type WaitingForRpc = NoErrorTypedAction<'engine:waitingForRpc', {waiting: boolean, rpcName: string}>

export type Actions = ErrorInRpc | WaitingForRpc

export type State = Record<{
  rpcWaitingStates: Map<string, boolean>,
}>

export const StateRecord = Record({
  rpcWaitingStates: Map(),
})
