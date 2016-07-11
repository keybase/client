/* @flow */
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
export const updateFollowing = 'config:updateFollowing'
export const updateFollowers = 'config:updateFollowers'

export const changeKBFSPath = 'config:changeKBFSPath'

export const devConfigLoading = 'config:devConfigLoading'
export const devConfigLoaded = 'config:devConfigLoaded'
export const devConfigUpdate = 'config:devConfigUpdate'
export const devConfigSaved = 'config:devConfigSaved'

export function privateFolderWithUsers (users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
}

export function publicFolderWithUsers (users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
}
