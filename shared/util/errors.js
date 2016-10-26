// @flow

class RPCError extends Error {
  code: number;

  constructor (message: string, code: number) {
    super(message || 'Unknown RPC Error')
    this.code = code
  }
}

// convertToError converts an RPC error object (or any object) into an Error
export function convertToError (err: Object): Error {
  if (err instanceof Error) {
    return err
  }

  if (err.hasOwnProperty('desc') && err.hasOwnProperty('code')) {
    return new RPCError(err.desc, err.code)
  }

  return new Error(`Unknown error: ${JSON.stringify(err)}`)
}
