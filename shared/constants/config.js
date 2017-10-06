// @flow
import uniq from 'lodash/uniq'
import {runMode} from './platform'

import type {ConversationIDKey} from './chat'
import type {Tab} from './tabs'
import type {BootstrapStatus, Config, DeviceID, ExtendedStatus} from './types/flow-types'
import type {NoErrorTypedAction} from './types/flux'

// TODO remove action type constants. Type actions
const MAX_BOOTSTRAP_TRIES = 3
const bootstrapAttemptFailed = 'config:bootstrapAttemptFailed'
const bootstrapFailed = 'config:bootstrapFailed'
const bootstrapSuccess = 'config:bootstrapSuccess'
const bootstrapStatusLoaded = 'config:bootstrapStatusLoaded'
const bootstrapRetry = 'config:bootstrapRetry'
const bootstrapRetryDelay = 10 * 1000
const changeKBFSPath = 'config:changeKBFSPath'
const configLoaded = 'config:configLoaded'
const daemonError = 'config:daemonError'
const defaultKBFSPath = runMode === 'prod' ? '/keybase' : `/keybase.${runMode}`
const defaultPrivatePrefix = '/private/'
const defaultPublicPrefix = '/public/'
const extendedConfigLoaded = 'config:extendedConfigLoaded'
const globalError = 'config:globalError'
const globalErrorDismiss = 'config:globalErrorDismiss'
const readAppVersion = 'config:readAppVersion'
const setFollowers = 'config:setFollowers'
const setFollowing = 'config:setFollowing'
const statusLoaded = 'config:statusLoaded'
const updateFollowing = 'config:updateFollowing'

export type BootstrapStatusLoaded = NoErrorTypedAction<
  'config:bootstrapStatusLoaded',
  {bootstrapStatus: BootstrapStatus}
>
export type DaemonError = NoErrorTypedAction<'config:daemonError', {daemonError: ?Error}>
export type UpdateFollowing = NoErrorTypedAction<
  'config:updateFollowing',
  {username: string, isTracking: boolean}
>

export type InitialState = {|
  conversation?: ConversationIDKey,
  tab?: Tab,
  url?: string,
|}

export type SetInitialState = NoErrorTypedAction<'config:setInitialState', InitialState>

export type PushLoaded = NoErrorTypedAction<'config:pushLoaded', boolean>

export type BootStatus = 'bootStatusLoading' | 'bootStatusBootstrapped' | 'bootStatusFailure'

export function privateFolderWithUsers(users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
}

export function publicFolderWithUsers(users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
}

export type State = {
  appFocused: boolean,
  userActive: boolean,
  appFocusedCount: number,
  bootStatus: BootStatus,
  pushLoaded: boolean,
  bootstrapTriesRemaining: number,
  config: ?Config,
  daemonError: ?Error,
  error: ?any,
  extendedConfig: ?ExtendedStatus,
  followers: {[key: string]: true},
  following: {[key: string]: true},
  globalError: ?Error,
  kbfsPath: string,
  loggedIn: boolean,
  registered: boolean,
  readyForBootstrap: boolean,
  uid: ?string,
  username: ?string,
  initialState: ?InitialState,
  deviceID: ?DeviceID,
  deviceName: ?string,
}

export {
  MAX_BOOTSTRAP_TRIES,
  bootstrapAttemptFailed,
  bootstrapFailed,
  bootstrapSuccess,
  bootstrapStatusLoaded,
  bootstrapRetry,
  bootstrapRetryDelay,
  changeKBFSPath,
  configLoaded,
  daemonError,
  defaultKBFSPath,
  defaultPrivatePrefix,
  defaultPublicPrefix,
  extendedConfigLoaded,
  globalError,
  globalErrorDismiss,
  readAppVersion,
  setFollowers,
  setFollowing,
  statusLoaded,
  updateFollowing,
}
