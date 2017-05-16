// @flow
import {uniq} from 'lodash'
import {runMode} from './platform'

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
const setLaunchedViaPush = 'config:setLaunchedViaPush'
const statusLoaded = 'config:statusLoaded'
const updateFollowing = 'config:updateFollowing'
const updateFollowings = 'config:updateFollowings'

export type BootstrapStatusLoaded = NoErrorTypedAction<
  'config:bootstrapStatusLoaded',
  {bootstrapStatus: BootstrapStatus}
>
export type DaemonError = NoErrorTypedAction<'config:daemonError', {daemonError: ?Error}>
export type UpdateFollowings = NoErrorTypedAction<'config:updateFollowings', {usernames: Array<string>}>
export type UpdateFollowing = NoErrorTypedAction<
  'config:updateFollowing',
  {username: string, isTracking: boolean}
>
export type SetInitialLink = NoErrorTypedAction<'config:setInitialLink', {url: ?string}>
export type SetInitialTab = NoErrorTypedAction<'config:setInitialTab', {tab: ?Tab}>
export type SetLaunchedViaPush = NoErrorTypedAction<'config:setLaunchedViaPush', boolean>

export type BootStatus = 'bootStatusLoading' | 'bootStatusBootstrapped' | 'bootStatusFailure'

export function privateFolderWithUsers(users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
}

export function publicFolderWithUsers(users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
}

export type State = {
  appFocused: boolean,
  hideKeyboard: number,
  bootStatus: BootStatus,
  bootstrapTriesRemaining: number,
  config: ?Config,
  daemonError: ?Error,
  error: ?any,
  extendedConfig: ?ExtendedStatus,
  followers: {[key: string]: true},
  following: {[key: string]: true},
  globalError: ?Error,
  kbfsPath: string,
  launchedViaPush: boolean,
  loggedIn: boolean,
  registered: boolean,
  readyForBootstrap: boolean,
  uid: ?string,
  username: ?string,
  initialTab: ?Tab,
  initialLink: ?string,
  deviceID: ?DeviceID,
  deviceName: ?string,
}

const stateLoggerTransform = (state: State) => ({
  appFocused: state.appFocused,
  bootStatus: state.bootStatus,
  bootstrapTriesRemaining: state.bootstrapTriesRemaining,
  config: state.config,
  daemonError: state.daemonError,
  error: state.error,
  extendedConfig: state.extendedConfig,
  globalError: state.globalError,
  launchedViaPush: state.launchedViaPush,
  loggedIn: state.loggedIn,
  registered: state.registered,
  readyForBootstrap: state.readyForBootstrap,
})

export {
  MAX_BOOTSTRAP_TRIES,
  stateLoggerTransform,
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
  setLaunchedViaPush,
  statusLoaded,
  updateFollowing,
  updateFollowings,
}
