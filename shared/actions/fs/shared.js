// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../fs-gen'
import type {TypedActions} from '../typed-actions-gen'
import * as SettingsConstants from '../../constants/settings'
import * as Tabs from '../../constants/tabs'
import * as RouteTreeGen from '../route-tree-gen'
import {isMobile} from '../../constants/platform'

export const fsRootRoute = isMobile ? [Tabs.settingsTab, SettingsConstants.fsTab] : [Tabs.fsTab]

const _getRouteChangeActionForPermissionError = (path: Types.Path) =>
  RouteTreeGen.createNavigateTo({
    path: [...fsRootRoute, {props: {path, reason: 'no-access'}, selected: 'oops'}],
  })

const _getRouteChangeActionForNonExistentError = (path: Types.Path) =>
  RouteTreeGen.createNavigateTo({
    path: [...fsRootRoute, {props: {path, reason: 'non-existent'}, selected: 'oops'}],
  })

const makeErrorHandler = (action: FsGen.Actions, retriable: boolean) => (error: any): TypedActions => {
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
  }
  return FsGen.createFsError({
    error: Constants.makeError({
      error,
      erroredAction: action,
      retriableAction: retriable ? action : undefined,
    }),
  })
}

export const makeRetriableErrorHandler = (action: FsGen.Actions) => makeErrorHandler(action, true)

export const makeUnretriableErrorHandler = (action: FsGen.Actions) => makeErrorHandler(action, false)
