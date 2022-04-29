import logger from '../logger'
import * as RPCTypes from '../constants/types/rpc-gen'
import capitalize from 'lodash/capitalize'
import {errors as transportErrors} from 'framed-msgpack-rpc'

export class RPCError {
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

function isRPCErrorLike(err: Object): err is RPCErrorLike {
  return (
    Object.prototype.hasOwnProperty.call(err, 'desc') && Object.prototype.hasOwnProperty.call(err, 'code')
  )
}

// convertToError converts an RPC error object (or any object) into an
// Error or RPCError.
export function convertToError(err: Object, method?: string): Error | RPCError {
  if (err instanceof Error || err instanceof RPCError) {
    return err
  }

  if (isRPCErrorLike(err)) {
    return convertToRPCError(err, method)
  }

  return new Error(`Unknown error: ${JSON.stringify(err)}`)
}

type RPCErrorLike = {
  code: number
  desc: string
  fields?: any
  name?: string
}

export function convertToRPCError(err: RPCErrorLike, method?: string | null): RPCError {
  return new RPCError(err.desc, err.code, err.fields, err.name, method)
}

export function logError(error: any) {
  logger.info(`logError: ${JSON.stringify(error)}`)
}

export const niceError = (e: RPCError) => {
  if (!e) {
    return ''
  }

  switch (e.code) {
    case RPCTypes.StatusCode.scnotfound:
      return "Sorry, can't find that username"
    case RPCTypes.StatusCode.scbadloginusernotfound:
      return 'Looks like an incorrect user'
    case RPCTypes.StatusCode.scbadloginpassword:
      return 'Looks like a bad password.'
    case RPCTypes.StatusCode.scdeleted:
      return 'This user looks deleted.'
    case RPCTypes.StatusCode.scalreadyloggedin:
      return 'You seem to be already logged in'
    case RPCTypes.StatusCode.screloginrequired:
      return 'You need to re-login'
    case RPCTypes.StatusCode.scnospaceondevice:
      return "Spaces aren't allowed in device names"
    case RPCTypes.StatusCode.scbademail:
      return "This doesn't seem like a valid email"
    case RPCTypes.StatusCode.scbadsignupusernametaken:
      return 'This username is already taken'
    case RPCTypes.StatusCode.scbadinvitationcode:
      return "This invite code doesn't look right"
    case RPCTypes.StatusCode.scdevicebadname:
      return 'Seems like an invalid device name'
    case RPCTypes.StatusCode.scdevicenameinuse:
      return 'This device name is already in use.'
    case RPCTypes.StatusCode.scgenericapierror:
    case RPCTypes.StatusCode.sctimeout:
    case RPCTypes.StatusCode.scapinetworkerror:
      return 'You are offline.'
    case RPCTypes.StatusCode.scbadsignupusernamedeleted:
      return 'Looks like this user was deleted, or something'
    case RPCTypes.StatusCode.scstreameof:
      return 'Looks like we took too long. Try again, but a little bit quicker maybe'
  }

  const caps = capitalize(e.desc || e.message || 'Unknown error')
  return caps.endsWith('.') ? `${caps}.` : caps
}

function isRPCError(error: RPCError | Error): error is RPCError {
  return error && typeof (error as RPCError).code === 'number'
}

export function isEOFError(error: RPCError | Error) {
  return (
    isRPCError(error) &&
    error.code &&
    error.code === transportErrors['EOF'] &&
    error.message === transportErrors.msg[error.code]
  )
}

const ignoredMsgs = ['context deadline exceeded in method keybase.1.SimpleFS.simpleFSSyncStatus']
const isIgnoredError = (error: RPCError | Error) => {
  if (isRPCError(error)) {
    if (ignoredMsgs.some(m => error.desc.includes(m))) {
      return true
    }
  }
  return false
}

export function isErrorTransient(error: RPCError | Error) {
  // 'EOF from server' error from rpc library thrown when service
  // restarts no need to show to user
  return isEOFError(error) || isIgnoredError(error)
}
