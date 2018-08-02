// @flow
import * as I from 'immutable'
import {type ConversationIDKey} from './chat2'
import {type Tab} from '../tabs'
import {type DeviceID, type ExtendedStatus} from './rpc-gen'
import {RPCError} from '../../util/errors'

export type InitialState = {|
  conversation?: ConversationIDKey,
  tab?: Tab,
  url?: string,
|}

export type BootStatus = 'bootStatusLoading' | 'bootStatusBootstrapped' | 'bootStatusFailure'

export type AvatarSizes = {
  '200': string,
  '360': string,
  '40': string,
}

export type _State = {
  appFocused: boolean,
  appFocusedCount: number,
  // MUST be a plain object for remotes to work correctly
  avatars: {[username: string]: AvatarSizes},
  configuredAccounts: I.List<string>,
  daemonError: ?Error,
  daemonHandshakeFailedReason: string,
  daemonHandshakeRetriesLeft: number,
  daemonHandshakeWaiters: I.Map<string, number>,
  logoutHandshakeWaiters: I.Map<string, number>,
  debugDump: Array<string>,
  deviceID: DeviceID,
  deviceName: ?string,
  error: any,
  extendedConfig: ?ExtendedStatus,
  followers: I.Set<string>,
  following: I.Set<string>,
  globalError: null | Error | RPCError,
  initialState: ?InitialState,
  justDeletedSelf: string,
  kbfsPath: string,
  loggedIn: boolean,
  menubarWindowID: number,
  notifySound: boolean,
  openAtLogin: boolean,
  pushLoaded: boolean,
  registered: boolean,
  startedDueToPush: boolean,
  uid: string,
  userActive: boolean,
  username: string,
  version: string,
  versionShort: string,
}
export type State = I.RecordOf<_State>
