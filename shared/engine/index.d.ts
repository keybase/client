import Session from './session'
import {RPCError} from '../util/errors'
import {IncomingCallMapType, CustomResponseIncomingCallMapType} from '../constants/types/rpc-all-gen'

type WaitingKey = string | Array<string>
export declare class Engine {
  dispatchWaitingAction: (key: WaitingKey, waiting: boolean, err: RPCError | null) => void
  reset(): void
  rpc(): void
  sagasAreReady(): void
  hasEverConnected(): boolean
  registerCustomResponse(s: string): void
  createSession(arg0: {
    incomingCallMap?: any
    waitingKey?: WaitingKey
    cancelHandler?: any
    dangling?: boolean
  }): Session
  _rpcOutgoing(arg0: {
    method: string
    params: Object | null | undefined | void
    callback: (...args: Array<any>) => void
    waitingKey?: WaitingKey
  }): void
}
export declare function getEngine(): Engine
export declare function makeEngine(arg0: any, arg1: any): Engine
export default getEngine
export {IncomingCallMapType, CustomResponseIncomingCallMapType}
