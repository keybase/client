// @flow
import * as I from 'immutable'
import * as Types from './types/config'
import * as ChatConstants from './chat2'
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
  daemonError: null,
  daemonHandshakeFailedReason: '',
  daemonHandshakeRetriesLeft: maxHandshakeTries,
  daemonHandshakeWaiters: I.Map(),
  debugDump: [],
  deviceID: '',
  deviceName: '',
  error: null,
  extendedConfig: null,
  followers: I.Set(),
  following: I.Set(),
  globalError: null,
  justDeletedSelf: '',
  loggedIn: false,
  logoutHandshakeWaiters: I.Map(),
  menubarWindowID: 0,
  notifySound: false,
  openAtLogin: true,
  pgpPopupOpen: false,
  pushLoaded: false,
  registered: false,
  startupConversation: ChatConstants.noConversationIDKey,
  startupDetailsLoaded: false,
  startupLink: '',
  startupTab: null,
  startupWasFromPush: false,
  uid: '',
  userActive: true,
  username: '',
})
