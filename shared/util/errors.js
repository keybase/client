// @flow

export class RPCError {
  message: string
  code: number // Consult type StatusCode in rpc-gen.js for what this means
  fields: any
  desc: string
  name: string
  details: string // Details w/ error code & method if it's present

  constructor(message: string, code: number, fields: any, name: ?string, method: ?string) {
    this.message = paramsToErrorMsg(message, code, fields, name, method)
    this.code = code // Consult type StatusCode in rpc-gen.js for what this means
    this.fields = fields
    this.desc = message
    this.name = name || ''
    this.details = paramsToErrorDetails(code, name, method)
  }
}

const paramsToErrorDetails = (code: number, name: ?string, method: ?string) => {
  let res = `Error code ${code}`
  if (name) {
    res += `: ${name}`
  }
  if (method) {
    res += ` in method ${method}`
  }
  return res
}

const paramsToErrorMsg = (
  message: string,
  code: number,
  fields: any,
  name: ?string,
  method: ?string
): string => {
  let msg = ''
  if (code) {
    msg += `ERROR CODE ${code} - `
  }
  msg += message || (name && `RPC Error: ${name}`) || 'Unknown RPC Error'
  if (method) {
    msg += ` in method ${method}`
  }
  return msg
}

// convertToError converts an RPC error object (or any object) into an Error
export function convertToError(err: Object, method?: string): Error {
  if (err instanceof Error) {
    return err
  }

  if (err instanceof RPCError) {
    return new Error(err.message)
  }

  if (err.hasOwnProperty('desc') && err.hasOwnProperty('code')) {
    return new Error(convertToRPCError(err, method).message)
  }

  return new Error(`Unknown error: ${JSON.stringify(err)}`)
}

export function convertToRPCError(
  err: {code: number, desc: string, fields?: any, name?: string},
  method?: ?string
): RPCError {
  return new RPCError(err.desc, err.code, err.fields, err.name, method)
}
