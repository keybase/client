// @flow
import {uniq} from 'lodash'
import {runMode} from './platform'

// Constants
export const defaultKBFSPath = runMode === 'prod' ? '/keybase' : `/keybase.${runMode}`
export const defaultPrivatePrefix = '/private/'
export const defaultPublicPrefix = '/public/'

// Actions
export const statusLoaded = 'config:statusLoaded'
export const configLoaded = 'config:configLoaded'
export const extendedConfigLoaded = 'config:extendedConfigLoaded'
export const bootstrapped = 'config:bootstrapped'
export const bootstrapFailed = 'config:bootstrapFailed'
export const updateFollowing = 'config:updateFollowing'
export const updateFollowers = 'config:updateFollowers'

export const readAppVersion = 'config:readAppVersion'

export const changeKBFSPath = 'config:changeKBFSPath'

export const devConfigLoading = 'config:devConfigLoading'
export const devConfigLoaded = 'config:devConfigLoaded'
export const devConfigUpdate = 'config:devConfigUpdate'
export const devConfigSaved = 'config:devConfigSaved'

export const MAX_BOOTSTRAP_TRIES = 3
export const bootstrapRetryDelay = 10 * 1000

export function privateFolderWithUsers (users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
}

export function publicFolderWithUsers (users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
}
