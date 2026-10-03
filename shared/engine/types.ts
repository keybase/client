import {StatusCode} from '@/constants/rpc/rpc-gen'
import type {ErrorType} from '@/engine/rpc-transport'
export type MethodKey = string
export type SessionID = number
export type WaitingKey = string | ReadonlyArray<string>
export type EndHandlerType = (session: {getId: () => SessionID; _startMethod?: MethodKey}) => void
export type ResponseType = {
  result?: (...args: Array<any>) => void
  error?: (...args: Array<any>) => void
  seqid?: number
  // True once answered, by the handler or by the session ending
  readonly settled?: boolean
  // Set by the handler: runs when the service cancels this call and its RPC goes on
  onCancelledByService?: () => void
}
export type RPCErrorHandler = (e: ErrorType) => void
export type CommonResponseHandler = {
  error: RPCErrorHandler
  result: (...rest: Array<any>) => void
}

// How the GUI refuses a prompt it will not answer
export const inputCanceledError = {code: StatusCode.scinputcanceled, desc: 'Input canceled'}
