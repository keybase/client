import type * as Framed from 'framed-msgpack-rpc'
import type Session from './session'
import type {RPCError} from '@/util/errors'
import type {IncomingCallMapType, CustomResponseIncomingCallMapType} from '@/constants/types/rpc-all-gen'

export type BatchParams = Array<{key: string | Array<string>; increment: boolean; error?: RPCError}>

export type WaitingKey = string | Array<string>
export declare class Engine {
  dispatchWaitingAction: (key: WaitingKey, waiting: boolean, err?: RPCError) => void
  reset(): void
  rpc(): void
  listenersAreReady(): void
  createSession(arg0: {
    incomingCallMap?: IncomingCallMapType
    waitingKey?: WaitingKey
    cancelHandler?: any
    dangling?: boolean
  }): Session
  _rpcOutgoing(p: {
    method: string
    params?: Object
    callback: (...args: Array<any>) => void
    incomingCallMap?: IncomingCallMapType
    waitingKey?: WaitingKey
  }): void
  _rpcClient: Framed.client.Client
}
export declare function getEngine(): Engine
export declare function makeEngine(
  emitWaiting: (b: BatchParams) => void,
  onConnected: (c: boolean) => void
): Engine
export default getEngine
export type {IncomingCallMapType, CustomResponseIncomingCallMapType}
