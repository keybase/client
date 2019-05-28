export type EndHandlerType = (session: Object) => void
export type MethodKey = string
export type SessionID = number
export type SessionIDKey = string // used in our maps, really converted to a string key
export type WaitingHandlerType = (waiting: boolean, method: string, sessionID: SessionID) => Object
export type ResponseType = {
  result: (...args: Array<any>) => void
  error: (...args: Array<any>) => void
}
export type RPCErrorHandler = (err: any) => void
export type CommonResponseHandler = {
  error: RPCErrorHandler
  result: (...rest: Array<any>) => void
}
export type Bool = boolean
export type Boolean = boolean
export type Bytes = Buffer
export type Double = number
export type Int = number
export type Int64 = number
export type Long = number
export type String = string
export type Uint = number
export type Uint64 = number
export {RPCError} from '../util/errors'
