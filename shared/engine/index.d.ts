import type Session from './session'
import type {RPCError} from '@/util/errors'
import type {IncomingCallMapType, CustomResponseIncomingCallMapType} from '@/constants/types/rpc-all-gen'
import type {CreateClientType} from './index.platform'

export type BatchParams = Array<{key: string | ReadonlyArray<string>; increment: boolean; error?: RPCError}>

export type WaitingKey = string | ReadonlyArray<string>
export declare class Engine {
  dispatchWaitingAction: (key: WaitingKey, waiting: boolean, err?: RPCError) => void
  reset(): void
  listenersAreReady(): void
  createSession(arg0: {
    incomingCallMap?: IncomingCallMapType
    waitingKey?: WaitingKey
    cancelHandler?: unknown
    dangling?: boolean
  }): Session
  _rpcOutgoing(p: {
    method: string
    params?: object
    callback: (...args: Array<any>) => void
    incomingCallMap?: IncomingCallMapType
    waitingKey?: WaitingKey
  }): void
  _rpcClient: CreateClientType
}
export declare function getEngine(): Engine
export declare function makeEngine(
  emitWaiting: (b: BatchParams) => void,
  onConnected: (c: boolean) => void,
  allowIncomingCalls?: boolean
): Engine
export default getEngine
export type {IncomingCallMapType, CustomResponseIncomingCallMapType}
