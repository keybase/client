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
export const noKBFSFailReason = "Can't connect to KBFS"
const defaultTeamPrefix = '/team/'

export const privateFolderWithUsers = (users: Array<string>) =>
  `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
export const publicFolderWithUsers = (users: Array<string>) =>
  `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
export const teamFolder = (team: string) => `${defaultKBFSPath}${defaultTeamPrefix}${team}`

export const makeOutOfDate: I.RecordFactory<Types._OutOfDate> = I.Record({
  critical: false,
  message: undefined,
  updating: false,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  appFocused: true,
  appFocusedCount: 0,
  avatars: I.Map(),
  configuredAccounts: I.List(),
  daemonError: null,
  daemonHandshakeFailedReason: '',
  daemonHandshakeRetriesLeft: maxHandshakeTries,
  daemonHandshakeState: 'starting',
  daemonHandshakeVersion: 1,
  daemonHandshakeWaiters: I.Map(),
  debugDump: [],
  defaultUsername: '',
  deviceID: '',
  deviceName: '',
  followers: I.Set(),
  following: I.Set(),
  globalError: null,
  justDeletedSelf: '',
  loggedIn: false,
  logoutHandshakeVersion: 1,
  logoutHandshakeWaiters: I.Map(),
  menubarWindowID: 0,
  notifySound: false,
  openAtLogin: true,
  outOfDate: undefined,
  pgpPopupOpen: false,
  pushLoaded: false,
  registered: false,
  startupConversation: ChatConstants.noConversationIDKey,
  startupDetailsLoaded: false,
  startupFollowUser: '',
  startupLink: '',
  startupTab: null,
  startupWasFromPush: false,
  uid: '',
  userActive: true,
  username: '',
})
