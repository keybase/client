// @flow
import logger from '../logger'
import * as RPCTypes from '../constants/types/rpc-gen'
import {capitalize} from 'lodash-es'
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
  name: string
  details: string // Details w/ error code & method if it's present

  constructor(message: string, code: number, fields: any, name: ?string, method: ?string) {
    const err = new Error(paramsToErrorMsg(message, code, fields, name, method))
    this.message = err.message
    this.name = 'RPCError'
    this.stack = err.stack

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

// convertToError converts an RPC error object (or any object) into an
// Error or RPCError.
export function convertToError(err: Object, method?: string): Error | RPCError {
  if (err instanceof Error || err instanceof RPCError) {
    return err
  }

  if (err.hasOwnProperty('desc') && err.hasOwnProperty('code')) {
    return convertToRPCError(err, method)
  }

  return new Error(`Unknown error: ${JSON.stringify(err)}`)
}

export function convertToRPCError(
  err: {code: number, desc: string, fields?: any, name?: string},
  method?: ?string
): RPCError {
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
    case RPCTypes.constantsStatusCode.scnotfound:
      return "Sorry, can't find that username"
    case RPCTypes.constantsStatusCode.scbadloginusernotfound:
      return 'Looks like an incorrect user'
    case RPCTypes.constantsStatusCode.scbadloginpassword:
      return 'Looks like a bad passphrase.'
    case RPCTypes.constantsStatusCode.scdeleted:
      return 'This user looks deleted.'
    case RPCTypes.constantsStatusCode.scalreadyloggedin:
      return 'You seem to be already logged in'
    case RPCTypes.constantsStatusCode.screloginrequired:
      return 'You need to re-login'
    case RPCTypes.constantsStatusCode.scnospaceondevice:
      return "Spaces aren't allowed in device names"
    case RPCTypes.constantsStatusCode.scbademail:
      return "This doesn't seem like a valid email"
    case RPCTypes.constantsStatusCode.scbadsignupusernametaken:
      return 'This username is already taken'
    case RPCTypes.constantsStatusCode.scbadinvitationcode:
      return "This invite code doesn't look right"
    case RPCTypes.constantsStatusCode.scdevicebadname:
      return 'Seems like an invalid device name'
    case RPCTypes.constantsStatusCode.scdevicenameinuse:
    case RPCTypes.constantsStatusCode.scgenericapierror:
    case RPCTypes.constantsStatusCode.sctimeout:
    case RPCTypes.constantsStatusCode.scapinetworkerror:
      return 'Looks like the internet is gone...'
    case RPCTypes.constantsStatusCode.scbadsignupusernamedeleted:
      return 'Looks like this user was deleted, or something'
    case RPCTypes.constantsStatusCode.scstreameof:
      return 'Looks like we took too long. Try again, but a little bit quicker maybe'
  }

  const caps = capitalize(e.desc || e.message || 'Unknown error')
  return caps.endsWith('.') ? caps : `${caps}.`
}

export function isEOFError(error: RPCError | Error) {
  return (
    error.code && error.code === transportErrors['EOF'] && error.message === transportErrors.msg[error.code]
  )
}

export function isErrorTransient(error: RPCError | Error) {
  // 'EOF from server' error from rpc library thrown when service
  // restarts no need to show to user
  return isEOFError(error)
}
