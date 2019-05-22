import Session from './session'
import {RPCError} from '../util/errors'
import {IncomingCallMapType, CustomResponseIncomingCallMapType} from '../constants/types/rpc-all-gen'

type WaitingKey = string | Array<string>
export declare class Engine {}
export declare function getEngine(): Engine
export declare function makeEngine(arg0: any, arg0: any): Engine
export default getEngine
export {IncomingCallMapType, CustomResponseIncomingCallMapType}
