// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../fs-gen'
import type {TypedActions} from '../typed-actions-gen'
import * as RouteTreeGen from '../route-tree-gen'
import flags from '../../util/feature-flags'

const makeErrorHandler = (action: FsGen.Actions, path: ?Types.Path, retriable: boolean) => (
  error: any
): Array<TypedActions> => {
  if (path) {
    // TODO: KBFS-4143 add and use proper error code for all these
    if (typeof error.desc === 'string') {
      if (
        error.desc.includes('does not have read access to') ||
        error.desc.includes('You are not a member of this team') ||
        // team doesn't exist
        error.desc.includes('Root team does not exist') ||
        // public tlf doesn't exist
        error.desc.includes("Can't create TLF ID for non-team-backed handle") ||
        // /keybase/private/non_existent_user
        error.desc.includes(' is not a Keybase user')
      ) {
        const tlfPath = Constants.getTlfPath(path)
        if (tlfPath) {
          return [FsGen.createSetTlfSoftError({path: tlfPath, softError: 'no-access'})]
        }
      }
      if (error.desc.includes('file does not exist')) {
        return [FsGen.createSetPathSoftError({path, softError: 'non-existent'})]
      }
    }
    if (error.desc.includes('KBFS client not found.')) {
      return [
        FsGen.createKbfsDaemonRpcStatusChanged({rpcStatus: 'wait-timeout'}),
        // We don't retry actions when re-connected, so just route user back
        // to root in case they get confused by orphan loading state.
        //
        // Although this seems impossible to do for nav2 as things are just
        // pushed on top of each other, so just don't do anything for now.
        // Perhaps it's OK.
        ...(flags.useNewRouter ? [] : [RouteTreeGen.createNavigateTo({path: Constants.fsRootRouteForNav1})]),
      ]
    }
  }
  return [
    FsGen.createFsError({
      error: Constants.makeError({
        error,
        erroredAction: action,
        retriableAction: retriable ? action : undefined,
      }),
    }),
  ]
}

export const makeRetriableErrorHandler = (action: FsGen.Actions, path: ?Types.Path) =>
  makeErrorHandler(action, path, true)

export const makeUnretriableErrorHandler = (action: FsGen.Actions, path: ?Types.Path) =>
  makeErrorHandler(action, path, false)
