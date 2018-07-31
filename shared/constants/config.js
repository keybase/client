// @flow
import * as I from 'immutable'
import * as Types from './types/config'
import {uniq} from 'lodash-es'
import {runMode} from './platform'

export const maxHandshakeTries = 3
export const defaultKBFSPath = runMode === 'prod' ? '/keybase' : `/keybase.${runMode}`
export const defaultPrivatePrefix = '/private/'
export const defaultPublicPrefix = '/public/'
const defaultTeamPrefix = '/team/'

export const privateFolderWithUsers = (users: Array<string>) =>
  `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
export const publicFolderWithUsers = (users: Array<string>) =>
  `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
export const teamFolder = (team: string) => `${defaultKBFSPath}${defaultTeamPrefix}${team}`

export const makeState: I.RecordFactory<Types._State> = I.Record({
  appFocused: true,
  appFocusedCount: 0,
  avatars: {}, // Can't be an I.Map since it's used by remotes
  configuredAccounts: I.List(),
  // bootStatus: 'bootStatusLoading',
  // bootstrapTriesRemaining: maxBootstrapTries,
  daemonError: null,
  daemonHandshakeWaiters: I.Map(),
  daemonHandshakeFailedReason: '',
  daemonHandshakeRetriesLeft: maxHandshakeTries,
  debugDump: [],
  deviceID: '',
  deviceName: '',
  error: null,
  extendedConfig: null,
  followers: I.Set(),
  following: I.Set(),
  globalError: null,
  initialState: null,
  kbfsPath: '',
  loggedIn: false,
  menubarWindowID: 0,
  notifySound: false,
  openAtLogin: true,
  pgpPopupOpen: false,
  pushLoaded: false,
  // readyForBootstrap,
  registered: false,
  startedDueToPush: false,
  uid: '',
  userActive: true,
  username: '',
  version: '',
  versionShort: '',
})
