import type {ErrorType} from '@/engine/rpc-transport'
export type MethodKey = string
export type SessionID = number
export type WaitingHandlerType = (waiting: boolean, method: string, sessionID: SessionID) => object
export type EndHandlerType = (session: {getId: () => SessionID; _startMethod?: MethodKey}) => void
export type ResponseType = {
  result?: (...args: Array<any>) => void
  error?: (...args: Array<any>) => void
  seqid?: number
}
export type RPCErrorHandler = (e: ErrorType) => void
export type CommonResponseHandler = {
  error: RPCErrorHandler
  result: (...rest: Array<any>) => void
}
export type Bool = boolean
export type Boolean = boolean
export type Bytes = Uint8Array
export type Double = number
export type Int = number
export type Int64 = number
export type Long = number
export type String = string
export type Uint = number
export type Uint64 = number
export {RPCError} from '@/util/errors'
