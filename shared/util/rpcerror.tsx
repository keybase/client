import {StatusCode} from '@/constants/rpc/rpc-gen'

// Who ended a cancelled call: the client (a cancel or dispose by the caller, or an account change),
// the link to the service going, or the service itself
export type CancelReason = 'caller' | 'accountChange' | 'disconnect' | 'service'
// Why a call failed. Set where the error is made: the client's own errors say what they are, and an
// error the service sent reads by its code. 'local': the call never left the client (a failed write).
export type RPCErrorKind =
  | {readonly type: 'cancelled'; readonly reason: CancelReason}
  // The service has no session for the call: logged out, or a session still being set up after a login
  | {readonly type: 'loginRequired'}
  | {readonly type: 'service'}
  | {readonly type: 'local'}

const cancelCodes: ReadonlyArray<number> = [StatusCode.sccanceled, StatusCode.scinputcanceled]

// An error the service sent. A cancel code reads as the service's cancel, which is also how the echo
// of a refusal the client wrote on one of its prompts comes back.
export const classifyCode = (code: number): RPCErrorKind => {
  if (cancelCodes.includes(code)) {
    return {reason: 'service', type: 'cancelled'}
  }
  if (code === StatusCode.scloginrequired) {
    return {type: 'loginRequired'}
  }
  return {type: 'service'}
}

class RPCError {
  // Fields to make RPCError 'look' like Error, since we don't want to
  // inherit from Error.
  message: string
  name: string
  stack: string

  code: StatusCode // Consult type StatusCode in rpc-gen.js for what this means
  fields: unknown
  desc: string
  details: string // Details w/ error code & method if it's present
  kind: RPCErrorKind

  constructor(
    message: string,
    code: number,
    fields: unknown = null,
    name?: string,
    method?: string,
    kind: RPCErrorKind = classifyCode(code)
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
    this.kind = kind
  }
}

const paramsToErrorDetails = (code: number, name?: string, method?: string) => {
  let res = `Error code ${code}`
  if (name) {
    res += `: ${name}`
  }
  if (method) {
    res += ` in method ${method}`
  }
  return res
}

const paramsToErrorMsg = (message: string, code: number, name?: string, method?: string): string => {
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
