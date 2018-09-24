// @flow strict
// $FlowIssue https://github.com/facebook/flow/issues/6628
import * as I from 'immutable'
import {type ConversationIDKey} from './chat2'
import {type Tab} from '../tabs'
import {type DeviceID} from './rpc-gen'
import {RPCError} from '../../util/errors'

export type AvatarSizes = {
  '200': string,
  '360': string,
  '40': string,
}

export type _State = {
  appFocused: boolean,
  appFocusedCount: number,
  avatars: {[username: string]: AvatarSizes}, // MUST be a plain object for remotes to work correctly
  configuredAccounts: I.List<string>,
  daemonError: ?Error,
  daemonHandshakeState: 'starting' | 'waitingForWaiters' | 'done',
  daemonHandshakeFailedReason: string,
  daemonHandshakeRetriesLeft: number,
  daemonHandshakeWaiters: I.Map<string, number>,
  // if we ever restart handshake up this so we can ignore any waiters for old things
  daemonHandshakeVersion: number,
  debugDump: Array<string>,
  deviceID: DeviceID,
  deviceName: ?string,
  defaultUsername: string,
  followers: I.Set<string>,
  following: I.Set<string>,
  globalError: null | Error | RPCError,
  justDeletedSelf: string,
  loggedIn: boolean,
  logoutHandshakeWaiters: I.Map<string, number>,
  logoutHandshakeVersion: number,
  menubarWindowID: number,
  mobileAppState: 'active' | 'background' | 'inactive',
  notifySound: boolean,
  openAtLogin: boolean,
  pushLoaded: boolean,
  registered: boolean,
  startupDetailsLoaded: boolean,
  startupWasFromPush: boolean,
  startupConversation: ConversationIDKey,
  startupFollowUser: string,
  startupLink: string,
  startupTab: ?Tab,
  touchIDState: 'asking' | 'done',
  touchIDEnabled: boolean,
  touchIDAllowedBySystem: string,
  uid: string,
  userActive: boolean,
  username: string,
}
export type State = I.RecordOf<_State>
