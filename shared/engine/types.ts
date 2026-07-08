import type {ErrorType} from '@/engine/rpc-transport'
export type MethodKey = string
export type SessionID = number
export type WaitingKey = string | ReadonlyArray<string>
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
