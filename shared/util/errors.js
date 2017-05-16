// @flow

export class RPCError extends Error {
  code: number
  fields: any
  desc: string // Don't use! This is for compatibility with RPC error object.

  constructor(message: string, code: number, fields: ?any) {
    super(message || 'Unknown RPC Error')
    this.code = code
    this.fields = fields
    this.desc = message // Don't use! This is for compatibility with RPC error object.
  }
}

export class ValidationError extends Error {}

// convertToError converts an RPC error object (or any object) into an Error
export function convertToError(err: Object): Error {
  if (err instanceof Error) {
    return err
  }

  if (err.hasOwnProperty('desc') && err.hasOwnProperty('code')) {
    return convertToRPCError(err)
  }

  return new Error(`Unknown error: ${JSON.stringify(err)}`)
}

export function convertToRPCError(err: {code: number, desc: string, fields?: any}): RPCError {
  return new RPCError(err.desc, err.code, err.fields)
}
