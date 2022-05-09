import type * as NetInfo from '@react-native-community/netinfo'
import type * as RPCTypes from './rpc-gen'
import type HiddenString from '../../util/hidden-string'
import type {ConversationIDKey} from './chat2'
import type {DarkModePreference} from '../../styles/dark-mode'
import type {RPCError} from '../../util/errors'
import type {Tab} from '../tabs'

export type OutOfDate = {
  critical: boolean
  message?: string
  updating: boolean
}
export type DaemonHandshakeState = 'starting' | 'waitingForWaiters' | 'done'
export type AppOutOfDateStatus = 'critical' | 'suggested' | 'ok' | 'checking'
export type ConfiguredAccount = {
  hasStoredSecret: boolean
  username: string
}
// 'notavailable' is the desktop default
export type ConnectionType = NetInfo.NetInfoStateType | 'notavailable'

export type WindowState = {
  dockHidden: boolean
  height: number
  isFullScreen: boolean
  width: number
  windowHidden: boolean
  x: number
  y: number
}

export type State = {
  allowAnimatedEmojis: boolean
  androidShare?:
    | {
        type: RPCTypes.IncomingShareType.file
        url: string
      }
    | {
        type: RPCTypes.IncomingShareType.text
        text: string
      }
  appFocused: boolean
  appFocusedCount: number
  appOutOfDateMessage: string
  appOutOfDateStatus: AppOutOfDateStatus
  avatarRefreshCounter: Map<string, number>
  configuredAccounts: Array<ConfiguredAccount>
  daemonError?: Error
  daemonHandshakeState: DaemonHandshakeState
  daemonHandshakeFailedReason: string
  daemonHandshakeRetriesLeft: number
  daemonHandshakeWaiters: Map<string, number>
  // if we ever restart handshake up this so we can ignore any waiters for old things
  daemonHandshakeVersion: number
  darkModePreference: DarkModePreference
  debugDump: Array<string>
  deviceID: RPCTypes.DeviceID
  deviceName?: string
  defaultUsername: string
  followers: Set<string>
  following: Set<string>
  globalError?: Error | RPCError
  httpSrvAddress: string
  httpSrvToken: string
  incomingShareUseOriginal?: boolean
  justDeletedSelf?: string
  loggedIn: boolean
  logoutHandshakeWaiters: Map<string, number>
  logoutHandshakeVersion: number
  mainWindowMax: boolean
  menubarWindowID: number
  notifySound: boolean
  openAtLogin: boolean
  osNetworkOnline: boolean
  outOfDate?: OutOfDate
  pushLoaded: boolean
  registered: boolean
  remoteWindowNeedsProps: Map<string, Map<string, number>>
  runtimeStats?: RPCTypes.RuntimeStats
  startupDetailsLoaded: boolean
  startupWasFromPush: boolean
  startupConversation: ConversationIDKey
  startupPushPayload?: string
  startupFile: HiddenString
  startupFollowUser: string
  startupLink: string
  startupTab?: Tab
  systemDarkMode: boolean
  windowShownCount: Map<string, number>
  windowState: WindowState
  uid: string
  userActive: boolean
  username: string
  userSwitching: boolean
  useNativeFrame: boolean
  whatsNewLastSeenVersion: string
}
