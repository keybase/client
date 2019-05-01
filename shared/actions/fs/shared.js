// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../fs-gen'
import type {TypedActions} from '../typed-actions-gen'
import * as RouteTreeGen from '../route-tree-gen'
import flags from '../../util/feature-flags'

const _makeActionsForNavigateUpThenRootThen = flags.useNewRouter
  ? finalRoute => [
      RouteTreeGen.createNavigateUp(), // This is unfortunate but we do need to get rid of the bad path.
      RouteTreeGen.createNavigateAppend({
        path: [{props: {path: Constants.defaultPath}, selected: 'tabs.fsTab'}, finalRoute],
      }),
    ]
  : finalRoute => [RouteTreeGen.createNavigateTo({path: [...Constants.fsRootRouteForNav1, finalRoute]})]

const _getRouteChangeActionForPermissionError = (path: Types.Path) =>
  _makeActionsForNavigateUpThenRootThen({props: {path, reason: 'no-access'}, selected: 'oops'})

const _getRouteChangeActionForNonExistentError = (path: Types.Path) =>
  _makeActionsForNavigateUpThenRootThen({props: {path, reason: 'non-existent'}, selected: 'oops'})

const makeErrorHandler = (action: FsGen.Actions, retriable: boolean) => (error: any): Array<TypedActions> => {
  // TODO: add and use proper error code for all these
  if (typeof error.desc === 'string') {
    if (
      error.desc.includes('does not have read access to') ||
      error.desc.includes('You are not a member of this team') ||
      // team doesn't exist
      error.desc.includes('Root team does not exist') ||
      // public tlf doesn't exist
      error.desc.includes("Can't create TLF ID for non-team-backed handle")
    ) {
      return _getRouteChangeActionForPermissionError(
        // If you get a flow error here after aadding an action that has a 'path'
        // field, try rename that field if the field is not of type FsTypes.Path.
        (action.payload && action.payload.path) || Constants.defaultPath
      )
    }
    if (error.desc.includes('file does not exist')) {
      return _getRouteChangeActionForNonExistentError(
        // If you get a flow error here after aadding an action that has a 'path'
        // field, try rename that field if the field is not of type FsTypes.Path.
        (action.payload && action.payload.path) || Constants.defaultPath
      )
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

export const makeRetriableErrorHandler = (action: FsGen.Actions) => makeErrorHandler(action, true)

export const makeUnretriableErrorHandler = (action: FsGen.Actions) => makeErrorHandler(action, false)
