class RPCError {
  // Fields to make RPCError 'look' like Error, since we don't want to
  // inherit from Error.
  message: string
  name: string
  stack: string

  code: number // Consult type StatusCode in rpc-gen.js for what this means
  fields: any
  desc: string
  details: string // Details w/ error code & method if it's present

  constructor(
    message: string,
    code: number,
    fields: any = null,
    name: string | null = null,
    method: string | null = null
  ) {
    const err = new Error(paramsToErrorMsg(message, code, name, method))
    this.message = err.message
    this.name = 'RPCError'
    this.stack = err.stack || ''

    this.code = code // Consult type StatusCode in rpc-gen.js for what this means
    this.fields = fields
    this.desc = message
    this.name = name || ''
    this.details = paramsToErrorDetails(code, name, method)
  }
}

const paramsToErrorDetails = (code: number, name: string | null, method: string | null) => {
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
  name: string | null,
  method: string | null
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

export default RPCError
