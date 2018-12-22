// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../fs-gen'
import type {TypedActions} from '../typed-actions-gen'
import * as SettingsConstants from '../../constants/settings'
import * as Tabs from '../../constants/tabs'
import {navigateTo} from '../route-tree'
import {isMobile} from '../../constants/platform'

const fsRootRoute = isMobile ? [Tabs.settingsTab, SettingsConstants.fsTab] : [Tabs.fsTab]

const _getRouteChangeActionForPermissionError = (path: Types.Path) =>
  navigateTo([...fsRootRoute, {props: {path}, selected: 'oopsNoAccess'}])

const makeErrorHandler = (action: FsGen.Actions, retriable: boolean) => (error: any): TypedActions => {
  if (
    (typeof error.desc === 'string' && error.desc.includes('does not have read access to')) ||
    error.desc.includes('You are not a member of this team')
  ) {
    // TODO: add a real error code for this
    return _getRouteChangeActionForPermissionError(
      // If you get a flow error here after aadding an action that has a 'path'
      // field, try rename that field if the field is not of type FsTypes.Path.
      (action.payload && action.payload.path) || Constants.defaultPath
    )
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
