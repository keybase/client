import * as I from 'immutable'
import * as Types from './types/config'
import * as ChatConstants from './chat2'
import {uniq} from 'lodash-es'
import {runMode} from './platform'
import {isDarkMode as _isDarkMode} from '../styles/dark-mode'

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

export const makeOutOfDate = I.Record<Types._OutOfDate>({
  critical: false,
  message: undefined,
  updating: false,
})

export const prepareAccountRows = <T extends {username: string; hasStoredSecret: boolean}>(
  accountRows: I.List<T>,
  myUsername: string
): I.List<T> =>
  accountRows
    .filter(account => account.username !== myUsername)
    .sortBy(account => [!account.hasStoredSecret, account.username])

export const urlToUsername = (url: {
  protocol: string
  username: string
  password: string
  hostname: string
  port: string
  pathname: string
}) => {
  const protocol = url.protocol
  if (protocol !== 'http:' && protocol !== 'https:') {
    return null
  }

  if (url.username || url.password) {
    return null
  }

  const hostname = url.hostname
  if (hostname !== 'keybase.io' && hostname !== 'www.keybase.io') {
    return null
  }

  const port = url.port
  if (port) {
    if (protocol === 'http:' && port !== '80') {
      return null
    }

    if (protocol === 'https:' && port !== '443') {
      return null
    }
  }

  const pathname = url.pathname
  // Adapted username regexp (see libkb/checkers.go) with a leading /, an
  // optional trailing / and a dash for custom links.
  const match = pathname.match(/^\/((?:[a-zA-Z0-9][a-zA-Z0-9_-]?)+)\/?$/)
  if (!match) {
    return null
  }

  const usernameMatch = match[1]
  if (usernameMatch.length < 2 || usernameMatch.length > 16) {
    return null
  }

  // Ignore query string and hash parameters.

  const username = usernameMatch.toLowerCase()
  return username
}
export const makeConfiguredAccount = I.Record<Types._ConfiguredAccount>({
  hasStoredSecret: false,
  username: '',
})

export const makeState = I.Record<Types._State>({
  appFocused: true,
  appFocusedCount: 0,
  appOutOfDateMessage: '',
  appOutOfDateStatus: 'checking',
  avatarRefreshCounter: I.Map(),
  configuredAccounts: I.List(),
  daemonError: null,
  daemonHandshakeFailedReason: '',
  daemonHandshakeRetriesLeft: maxHandshakeTries,
  daemonHandshakeState: 'starting',
  daemonHandshakeVersion: 1,
  daemonHandshakeWaiters: I.Map(),
  darkModePreference: undefined,
  debugDump: [],
  defaultUsername: '',
  deviceID: '',
  deviceName: '',
  followers: I.Set(),
  following: I.Set(),
  globalError: null,
  httpSrvAddress: '',
  httpSrvToken: '',
  justDeletedSelf: '',
  loggedIn: false,
  logoutHandshakeVersion: 1,
  logoutHandshakeWaiters: I.Map(),
  menubarWindowID: 0,
  notifySound: false,
  openAtLogin: true,
  osNetworkOnline: false,
  outOfDate: undefined,
  pushLoaded: false,
  registered: false,
  runtimeStats: null,
  startupConversation: ChatConstants.noConversationIDKey,
  startupDetailsLoaded: false,
  startupFollowUser: '',
  startupLink: '',
  startupSharePath: '',
  startupTab: null,
  startupWasFromPush: false,
    systemDarkMode: false,
  uid: '',
  userActive: true,
  username: '',
})

// we proxy the style helper to keep the logic in one place but act like a selector
export const isDarkMode = (_: Types._State) => _isDarkMode()
