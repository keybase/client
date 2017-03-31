// @flow
import {uniq} from 'lodash'
import {runMode} from './platform'

import type {Tab} from './tabs'
import type {NoErrorTypedAction} from './types/flux'

// TODO remove action type constants. Type actions
const MAX_BOOTSTRAP_TRIES = 3
const bootstrapAttemptFailed = 'config:bootstrapAttemptFailed'
const bootstrapFailed = 'config:bootstrapFailed'
const bootstrapRetry = 'config:bootstrapRetry'
const bootstrapRetryDelay = 10 * 1000
const bootstrapped = 'config:bootstrapped'
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

export type DaemonError = NoErrorTypedAction<'config:daemonError', {daemonError: ?Error}>
export type UpdateFollowing = NoErrorTypedAction<'config:updateFollowing', {username: string, isTracking: boolean}>
export type SetInitialTab = NoErrorTypedAction<'config:setInitialTab', {tab: ?Tab}>

export type BootStatus = 'bootStatusLoading'
  | 'bootStatusBootstrapped'
  | 'bootStatusFailure'

export function privateFolderWithUsers (users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
}

export function publicFolderWithUsers (users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
}

export {
  MAX_BOOTSTRAP_TRIES,
  bootstrapAttemptFailed,
  bootstrapFailed,
  bootstrapRetry,
  bootstrapRetryDelay,
  bootstrapped,
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
