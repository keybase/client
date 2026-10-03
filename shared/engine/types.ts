import {StatusCode} from '@/constants/rpc/rpc-gen'
import type {ErrorType} from '@/engine/rpc-transport'
import type {RPCError} from '@/util/errors'
import type {WaitingKeys} from '@/constants/waiting-key-type'
export type MethodKey = string
export type SessionID = number
export type {WaitingKeys}
// One change to a waiting key: a call starts or stops waiting on it, or, having stopped already, only
// records how it ended
export type WaitingChange =
  | {readonly key: WaitingKeys; readonly increment: boolean; readonly error?: RPCError}
  | {readonly key: WaitingKeys; readonly increment?: undefined; readonly error: RPCError}
export type EndHandlerType = (session: {getId: () => SessionID; _startMethod?: MethodKey}) => void
export type ResponseType = {
  result?: (...args: Array<any>) => void
  error?: (...args: Array<any>) => void
  seqid?: number
  // True once answered, by the handler or by the session ending
  readonly settled?: boolean
}
export type RPCErrorHandler = (e: ErrorType) => void
export type CommonResponseHandler = {
  error: RPCErrorHandler
  result: (...rest: Array<any>) => void
}

// How the GUI refuses a prompt it will not answer
export const inputCanceledError = {code: StatusCode.scinputcanceled, desc: 'Input canceled'}
