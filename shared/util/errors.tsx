import logger from '@/logger'
import * as T from '@/constants/types'
import capitalize from 'lodash/capitalize'
import {errors as transportErrors} from 'framed-msgpack-rpc'
import RPCError from './rpcerror'

function isRPCErrorLike(err: object): err is RPCErrorLike {
  return Object.hasOwn(err, 'desc') && Object.hasOwn(err, 'code')
}

// convertToError converts an RPC error object (or any object) into an
// Error or RPCError.
export function convertToError(err: unknown, method?: string): Error | RPCError {
  if (err instanceof Error || err instanceof RPCError) {
    return err
  }

  if (!err) {
    return new Error('blank error')
  }

  if (typeof err === 'object') {
    if (isRPCErrorLike(err)) {
      return convertToRPCError(err, method)
    }
  }

  try {
    return new Error(`Unknown error: ${JSON.stringify(err)}`)
  } catch {
    return new Error(`Unknown error`)
  }
}

type RPCErrorLike = {
  code: number
  desc: string
  fields?: unknown
  name?: string
}

function convertToRPCError(err: RPCErrorLike, method?: string): RPCError {
  return new RPCError(err.desc, err.code, err.fields, err.name, method)
}

export function logError(error: unknown) {
  logger.info(`logError: ${JSON.stringify(error)}`)
}

export const niceError = (e: RPCError) => {
  switch (e.code) {
    case T.RPCGen.StatusCode.scnotfound:
      return "Sorry, can't find that username"
    case T.RPCGen.StatusCode.scbadloginusernotfound:
      return 'Looks like an incorrect user'
    case T.RPCGen.StatusCode.scbadloginpassword:
      return 'Looks like a bad password.'
    case T.RPCGen.StatusCode.scdeleted:
      return 'This user looks deleted.'
    case T.RPCGen.StatusCode.scalreadyloggedin:
      return 'You seem to be already logged in'
    case T.RPCGen.StatusCode.screloginrequired:
      return 'You need to re-login'
    case T.RPCGen.StatusCode.scnospaceondevice:
      return "Spaces aren't allowed in device names"
    case T.RPCGen.StatusCode.scbademail:
      return "This doesn't seem like a valid email"
    case T.RPCGen.StatusCode.scbadsignupusernametaken:
      return 'This username is already taken'
    case T.RPCGen.StatusCode.scbadinvitationcode:
      return "This invite code doesn't look right"
    case T.RPCGen.StatusCode.scdevicebadname:
      return 'Seems like an invalid device name'
    case T.RPCGen.StatusCode.scdevicenameinuse:
      return 'This device name is already in use.'
    case T.RPCGen.StatusCode.scgenericapierror:
    case T.RPCGen.StatusCode.sctimeout:
    case T.RPCGen.StatusCode.scapinetworkerror:
      return 'You are offline.'
    case T.RPCGen.StatusCode.scbadsignupusernamedeleted:
      return 'Looks like this user was deleted, or something'
    case T.RPCGen.StatusCode.scstreameof:
      return 'Looks like we took too long. Try again, but a little bit quicker maybe'
    default: {
      const caps = capitalize(e.desc || e.message || 'Unknown error')
      return caps.endsWith('.') ? `${caps}.` : caps
    }
  }
}

function isRPCError(error: RPCError | Error): error is RPCError {
  return typeof (error as RPCError).code === 'number'
}

export function isEOFError(error: RPCError | Error) {
  return (
    isRPCError(error) &&
    error.code &&
    (error.code as number) === transportErrors['EOF'] &&
    error.message === transportErrors.msg[transportErrors['EOF']]
  )
}

const ignoredMsgs = ['context deadline exceeded in method keybase.1.SimpleFS.simpleFSSyncStatus']
const isIgnoredError = (error: RPCError | Error) => {
  if (isRPCError(error)) {
    if (ignoredMsgs.some(m => error.message.includes(m))) {
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

export {RPCError}

const networkErrorCodes = [
  T.RPCGen.StatusCode.scgenericapierror,
  T.RPCGen.StatusCode.scapinetworkerror,
  T.RPCGen.StatusCode.sctimeout,
]

export const isNetworkErr = (code: number) => networkErrorCodes.includes(code)
