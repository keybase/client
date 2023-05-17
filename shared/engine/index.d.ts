import type Session from './session'
import type {RPCError} from '../util/errors'
import type {IncomingCallMapType, CustomResponseIncomingCallMapType} from '../constants/types/rpc-all-gen'

export type WaitingKey = string | Array<string>
export declare class Engine {
  dispatchWaitingAction: (key: WaitingKey, waiting: boolean, err?: RPCError) => void
  reset(): void
  rpc(): void
  listenersAreReady(): void
  registerCustomResponse(s: string): void
  // instead of dispatching incoming as an action, just call me back
  registerRpcCallback<AT>(rpcName: string, cb: (action: AT) => void): void
  createSession(arg0: {
    incomingCallMap?: IncomingCallMapType
    waitingKey?: WaitingKey
    cancelHandler?: any
    dangling?: boolean
  }): Session
  _rpcOutgoing(p: {
    method: string
    params?: Object | void
    callback: (...args: Array<any>) => void
    waitingKey?: WaitingKey
  }): void
}
export declare function getEngine(): Engine
export declare function makeEngine(dispatch: (a: any) => any): Engine
export default getEngine
export type {IncomingCallMapType, CustomResponseIncomingCallMapType}
