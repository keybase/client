import * as Types from '../../constants/types/fs'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/fs'
import * as FsGen from '../fs-gen'
import {TypedActions} from '../typed-actions-gen'

const expectedOfflineErrorMatchers = [
  /write: can't assign requested address/,
  /dial tcp: lookup .* no such host/,
  /context deadline exceeded/,
]

const expectedOfflineErrorCodes = [RPCTypes.StatusCode.scapinetworkerror, RPCTypes.StatusCode.scstreameof]

const makeErrorHandler = (action: TypedActions, path: Types.Path | null, retriable: boolean) => (
  error: any
): Array<TypedActions> => {
  if (error?.code === RPCTypes.StatusCode.sckbfsclienttimeout) {
    return [FsGen.createCheckKbfsDaemonRpcStatus()]
  }
  const errorDesc = typeof error.desc === 'string' ? error.desc : ''
  if (path && errorDesc) {
    // TODO: KBFS-4143 add and use proper error code for all these
    if (
      errorDesc.includes('does not have read access to') ||
      errorDesc.includes('You are not a member of this team') ||
      // team doesn't exist
      errorDesc.includes('Root team does not exist') ||
      // public tlf doesn't exist
      errorDesc.includes("Can't create TLF ID for non-team-backed handle") ||
      // /keybase/private/non_existent_user
      errorDesc.includes(' is not a Keybase user')
    ) {
      const tlfPath = Constants.getTlfPath(path)
      if (tlfPath) {
        return [FsGen.createSetTlfSoftError({path: tlfPath, softError: Types.SoftError.NoAccess})]
      }
    }
    if (
      errorDesc.includes('file does not exist') ||
      errorDesc.includes(" doesn't exist") ||
      errorDesc.includes("Couldn't find local conflict handle for")
    ) {
      return [FsGen.createSetPathSoftError({path, softError: Types.SoftError.Nonexistent})]
    }
  }
  return [
    FsGen.createFsError({
      error: Constants.makeError({
        error,
        erroredAction: action,
        retriableAction: retriable ? (action as any) : undefined,
      }),
      expectedIfOffline:
        (error.code && expectedOfflineErrorCodes.includes(error.code)) ||
        expectedOfflineErrorMatchers.some(matcher => !!errorDesc.match(matcher)),
    }),
  ]
}

export const makeRetriableErrorHandler = (action: TypedActions, path?: Types.Path) =>
  makeErrorHandler(action, path || null, true)

export const makeUnretriableErrorHandler = (action: TypedActions, path?: Types.Path) =>
  makeErrorHandler(action, path || null, false)
