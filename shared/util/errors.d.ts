export declare class RPCError {
  // Fields to make RPCError 'look' like Error, since we don't want to
  // inherit from Error.
  message: string
  name: string
  stack: string

  code: number // Consult type StatusCode in rpc-gen.js for what this means
  fields: any
  desc: string
  details: string // Details w/ error code & method if it's present

  constructor(message: string, code: number, fields?: any, name?: string | null, method?: string | null)
}

type RPCErrorLike = {
  code: number
  desc: string
  fields?: any
  name?: string
}
export function convertToError(err: Object, method?: string): Error | RPCError
export function convertToRPCError(err: RPCErrorLike, method?: string | null): RPCError
export function logError(error: any): void
export function niceError(e: RPCError): string
export function isEOFError(error: RPCError | Error): boolean
export function isErrorTransient(error: RPCError | Error): boolean
