// @flow

// NOTICE: Doing `instanceof RPCError` (or any Error subtypes) will fail until a
// fix goes in. We aren't doing this anywhere yet though.
// TODO(mgood): Remove this when your fix goes in
export class RPCError extends Error {
  code: number;
  fields: any;
  desc: string; // Don't use! This is for compatibility with RPC error object.

  constructor (message: string, code: number, fields: ?any) {
    super(message || 'Unknown RPC Error')
    this.code = code
    this.fields = fields
    this.desc = message // Don't use! This is for compatibility with RPC error object.
  }
}

export class ValidationError extends Error { }

// convertToError converts an RPC error object (or any object) into an Error
export function convertToError (err: Object): Error {
  if (err instanceof Error) {
    return err
  }

  if (err.hasOwnProperty('desc') && err.hasOwnProperty('code')) {
    return new RPCError(err.desc, err.code, err.fields)
  }

  return new Error(`Unknown error: ${JSON.stringify(err)}`)
}
