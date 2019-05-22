type Fields = Array<{
  key: string
  value: string | boolean
}> | null

export declare class RPCError {}
export declare function niceError(e: RPCError): string
export declare function logError(error: RPCError): void

export declare function convertToRPCError(
  err: {
    code: number
    desc: string
    fields?: Fields
    name?: string
  },
  method?: string | null
): RPCError

export declare function convertToError<A>(err: A, method?: string): Error | RPCError
export declare function isEOFError(error: RPCError | Error): boolean
export declare function isErrorTransient(error: RPCError | Error): boolean
