// @flow
import uniq from 'lodash/uniq'
import {isMobile, runMode} from './platform'
import type {State} from './types/config'

export const maxBootstrapTries = 3
export const bootstrapRetryDelay = 10 * 1000
export const defaultKBFSPath = runMode === 'prod' ? '/keybase' : `/keybase.${runMode}`
export const defaultPrivatePrefix = '/private/'
export const defaultPublicPrefix = '/public/'
const defaultTeamPrefix = '/team/'
// Mobile is ready for bootstrap automatically, desktop needs to wait for
// the installer.
const readyForBootstrap = isMobile

export const privateFolderWithUsers = (users: Array<string>) =>
  `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
export const publicFolderWithUsers = (users: Array<string>) =>
  `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
export const teamFolder = (team: string) => `${defaultKBFSPath}${defaultTeamPrefix}${team}`

export const initialState: State = {
  appFocused: true,
  appFocusedCount: 0,
  bootStatus: 'bootStatusLoading',
  bootstrapTriesRemaining: maxBootstrapTries,
  config: null,
  daemonError: null,
  deviceID: null,
  deviceName: null,
  error: null,
  extendedConfig: null,
  followers: {},
  following: {},
  globalError: null,
  initialState: null,
  kbfsPath: defaultKBFSPath,
  loggedIn: false,
  pushLoaded: false,
  readyForBootstrap,
  registered: false,
  uid: null,
  userActive: true,
  username: null,
}
