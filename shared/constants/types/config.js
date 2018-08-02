// @flow
import * as I from 'immutable'
import {type ConversationIDKey} from './chat2'
import {type Tab} from '../tabs'
import {type DeviceID, type ExtendedStatus} from './rpc-gen'
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
  daemonHandshakeFailedReason: string,
  daemonHandshakeRetriesLeft: number,
  daemonHandshakeWaiters: I.Map<string, number>,
  debugDump: Array<string>,
  deviceID: DeviceID,
  deviceName: ?string,
  error: any,
  extendedConfig: ?ExtendedStatus,
  followers: I.Set<string>,
  following: I.Set<string>,
  globalError: null | Error | RPCError,
  justDeletedSelf: string,
  loggedIn: boolean,
  logoutHandshakeWaiters: I.Map<string, number>,
  menubarWindowID: number,
  notifySound: boolean,
  openAtLogin: boolean,
  pushLoaded: boolean,
  registered: boolean,
  startupDetailsLoaded: boolean,
  startupWasFromPush: boolean,
  startupConversation: ConversationIDKey,
  startupLink: string,
  startupTab: ?Tab,
  uid: string,
  userActive: boolean,
  username: string,
}
export type State = I.RecordOf<_State>
