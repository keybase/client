// @flow
import {uniq} from 'lodash'
import {runMode} from './platform'

import type {NoErrorTypedAction} from './types/flux'

// Constants
export const defaultKBFSPath = runMode === 'prod' ? '/keybase' : `/keybase.${runMode}`
export const defaultPrivatePrefix = '/private/'
export const defaultPublicPrefix = '/public/'

// Actions
export const daemonError = 'config:daemonError'
export const globalError = 'config:globalError'
export const globalErrorDismiss = 'config:globalErrorDismiss'
export const statusLoaded = 'config:statusLoaded'
export const configLoaded = 'config:configLoaded'
export const extendedConfigLoaded = 'config:extendedConfigLoaded'
export const bootstrapped = 'config:bootstrapped'
export const bootstrapAttemptFailed = 'config:bootstrapAttemptFailed'
export const bootstrapFailed = 'config:bootstrapFailed'
export const bootstrapRetry = 'config:bootstrapRetry'
export const updateFollowing = 'config:updateFollowing'
export const setFollowing = 'config:setFollowing'
export const setFollowers = 'config:setFollowers'

export const readAppVersion = 'config:readAppVersion'

export const changeKBFSPath = 'config:changeKBFSPath'

export const MAX_BOOTSTRAP_TRIES = 3
export const bootstrapRetryDelay = 10 * 1000

export type DaemonError = NoErrorTypedAction<'config:daemonError', {daemonError: ?Error}>
export type UpdateFollowing = NoErrorTypedAction<'config:updateFollowing', {username: string, isTracking: boolean}>

export type BootStatus = 'bootStatusLoading'
  | 'bootStatusBootstrapped'
  | 'bootStatusFailure'

export function privateFolderWithUsers (users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
}

export function publicFolderWithUsers (users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
}

