import type * as NetInfo from '@react-native-community/netinfo'
import type * as RPCTypes from './rpc-gen'
import type HiddenString from '../../util/hidden-string'
import type {ConversationIDKey} from './chat2'
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

export type State = {
  loggedIn: boolean
  osNetworkOnline: boolean
  outOfDate?: OutOfDate
  pushLoaded: boolean
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
  userActive: boolean
  userSwitching: boolean
  whatsNewLastSeenVersion: string
}
