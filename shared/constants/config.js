// @flow
import {uniq} from 'lodash'
import {runMode} from './platform'

import type {Tab} from './tabs'
import type {BootstrapStatus} from './types/flow-types'
import type {NoErrorTypedAction} from './types/flux'

// TODO remove action type constants. Type actions
const MAX_BOOTSTRAP_TRIES = 3
const bootstrapAttemptFailed = 'config:bootstrapAttemptFailed'
const bootstrapFailed = 'config:bootstrapFailed'
const bootstrapLoaded = 'config:bootstrapLoaded'
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

export type BootstrapLoaded = NoErrorTypedAction<'config:bootstrapLoaded', {bootstrapStatus: BootstrapStatus}>
export type DaemonError = NoErrorTypedAction<'config:daemonError', {daemonError: ?Error}>
export type UpdateFollowing = NoErrorTypedAction<'config:updateFollowing', {username: string, isTracking: boolean}>
export type SetInitialTab = NoErrorTypedAction<'config:setInitialTab', {tab: ?Tab}>
export type SetInitialLink = NoErrorTypedAction<'config:setInitialLink', {url: string}>
export type SetLaunchedViaPush = NoErrorTypedAction<'config:setLaunchedViaPush', boolean>

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
  bootstrapLoaded,
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
}
