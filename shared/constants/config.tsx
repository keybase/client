import * as Types from './types/config'
import * as ChatConstants from './chat2'
import uniq from 'lodash/uniq'
import {defaultUseNativeFrame, runMode} from './platform'
import {isDarkMode as _isDarkMode} from '../styles/dark-mode'
import URL from 'url-parse'

export const loginAsOtherUserWaitingKey = 'config:loginAsOther'
export const createOtherAccountWaitingKey = 'config:createOther'

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

export const prepareAccountRows = <T extends {username: string; hasStoredSecret: boolean}>(
  accountRows: Array<T>,
  myUsername: string
): Array<T> => accountRows.filter(account => account.username !== myUsername)

export const urlToUsername = (url: URL) => {
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

export const urlToTeamDeepLink = (url: URL) => {
  // Similar regexp to username but allow `.` for subteams
  const match = url.pathname.match(/^\/team\/((?:[a-zA-Z0-9][a-zA-Z0-9_.-]?)+)\/?$/)
  if (!match) {
    return null
  }

  const teamName = match[1]
  if (teamName.length < 2 || teamName.length > 16) {
    return null
  }

  // `url.query` has a wrong type in @types/url-parse. It's a `string` in the
  // code we are pulling in, but a [string]string object in @types.
  const queryString: string = url.query as any

  // URLSearchParams is not available in react-native. See if any of recognized
  // query parameters is passed using regular expressions.
  const action = (['add_or_invite', 'manage_settings'] as const).find(x =>
    queryString.match(`[?&]applink=${x}([?&].+)?$`)
  )
  return {action, teamName}
}

export const getRemoteWindowPropsCount = (state: Types.State, component: string, params: string) => {
  const m = state.remoteWindowNeedsProps.get(component)
  return (m && m.get(params)) || 0
}

export const initialState: Types.State = {
  androidShare: undefined,
  appFocused: true,
  appFocusedCount: 0,
  appOutOfDateMessage: '',
  appOutOfDateStatus: 'checking',
  avatarRefreshCounter: new Map(),
  configuredAccounts: [],
  daemonHandshakeFailedReason: '',
  daemonHandshakeRetriesLeft: maxHandshakeTries,
  daemonHandshakeState: 'starting',
  daemonHandshakeVersion: 1,
  daemonHandshakeWaiters: new Map(),
  darkModePreference: undefined,
  debugDump: [],
  defaultUsername: '',
  deviceID: '',
  deviceName: '',
  followers: new Set(),
  following: new Set(),
  httpSrvAddress: '',
  httpSrvToken: '',
  justDeletedSelf: '',
  loggedIn: false,
  logoutHandshakeVersion: 1,
  logoutHandshakeWaiters: new Map(),
  menubarWindowID: 0,
  notifySound: false,
  openAtLogin: true,
  osNetworkOnline: false,
  outOfDate: undefined,
  pushLoaded: false,
  registered: false,
  remoteWindowNeedsProps: new Map(),
  startupConversation: ChatConstants.noConversationIDKey,
  startupDetailsLoaded: false,
  startupFollowUser: '',
  startupLink: '',
  startupWasFromPush: false,
  systemDarkMode: false,
  uid: '',
  useNativeFrame: defaultUseNativeFrame,
  userActive: true,
  userSwitching: false,
  username: '',
  whatsNewLastSeenVersion: '',
  windowState: {
    dockHidden: false,
    height: 800,
    isFullScreen: false,
    width: 600,
    windowHidden: false,
    x: 0,
    y: 0,
  },
}

// we proxy the style helper to keep the logic in one place but act like a selector
export const isDarkMode = (_: Types.State) => _isDarkMode()
