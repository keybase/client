/* @flow */

// Constants
export const defaultKBFSPath = '/keybase'
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
  return `${defaultKBFSPath}${defaultPrivatePrefix}${users.join(',')}`
}

export function publicFolderWithUsers (users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPublicPrefix}${users.join(',')}`
}
