import * as I from 'immutable'
import {ConversationIDKey} from './chat2'
import {Tab} from '../tabs'
import {DeviceID} from './rpc-gen'
import {RPCError} from '../../util/errors'
import {LocalPath} from '../../constants/types/fs'

export type _OutOfDate = {
  critical: boolean
  message?: string
  updating: boolean
}
export type OutOfDate = I.RecordOf<_OutOfDate>
export type DaemonHandshakeState = 'starting' | 'waitingForWaiters' | 'done'
export type AppOutOfDateStatus = 'critical' | 'suggested' | 'ok' | 'checking'

export type _State = {
  appFocused: boolean
  appFocusedCount: number
  appOutOfDateMessage: string
  appOutOfDateStatus: AppOutOfDateStatus
  avatars: I.Map<string, I.Map<number, string>>
  configuredAccounts: I.List<string>
  daemonError: Error | null
  daemonHandshakeState: DaemonHandshakeState
  daemonHandshakeFailedReason: string
  daemonHandshakeRetriesLeft: number
  daemonHandshakeWaiters: I.Map<string, number>
  // if we ever restart handshake up this so we can ignore any waiters for old things
  daemonHandshakeVersion: number
  debugDump: Array<string>
  deviceID: DeviceID
  deviceName: string | null
  defaultUsername: string
  followers: I.Set<string>
  following: I.Set<string>
  globalError: null | Error | RPCError
  justDeletedSelf: string
  loggedIn: boolean
  logoutHandshakeWaiters: I.Map<string, number>
  logoutHandshakeVersion: number
  menubarWindowID: number
  notifySound: boolean
  openAtLogin: boolean
  osNetworkOnline: boolean
  outOfDate?: OutOfDate | null
  pushLoaded: boolean
  registered: boolean
  startupDetailsLoaded: boolean
  startupWasFromPush: boolean
  startupConversation: ConversationIDKey
  startupFollowUser: string
  startupLink: string
  startupTab: Tab | null
  startupSharePath: LocalPath | null
  uid: string
  userActive: boolean
  username: string
}
export type State = I.RecordOf<_State>
