import {StatusCode} from '@/constants/rpc/rpc-gen'
import type {ErrorType} from '@/engine/rpc-transport'
import type {RPCError} from '@/util/errors'
export type MethodKey = string
export type SessionID = number
export type WaitingKey = string | ReadonlyArray<string>
// One change to a waiting key: a call starts or stops waiting on it, or, having stopped already, only
// records how it ended
export type WaitingChange =
  | {readonly key: WaitingKey; readonly increment: boolean; readonly error?: RPCError}
  | {readonly key: WaitingKey; readonly increment?: undefined; readonly error: RPCError}
export type EndHandlerType = (session: {getId: () => SessionID; _startMethod?: MethodKey}) => void
export type ResponseType = {
  result?: (...args: Array<any>) => void
  error?: (...args: Array<any>) => void
  seqid?: number
  // True once answered, by the handler or by the session ending
  readonly settled?: boolean
  // Set by the listener: runs when the service cancels this call and its RPC goes on
  onCancelledByService?: () => void
}
export type RPCErrorHandler = (e: ErrorType) => void
export type CommonResponseHandler = {
  error: RPCErrorHandler
  result: (...rest: Array<any>) => void
}

// How the GUI refuses a prompt it will not answer
export const inputCanceledError = {code: StatusCode.scinputcanceled, desc: 'Input canceled'}
