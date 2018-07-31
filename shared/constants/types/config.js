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
  daemonError: ?Error,
  daemonHandshakeWaiters: I.Map<string, number>,
  daemonHandshakeFailedReason: string,
  daemonHandshakeRetriesLeft: number,
  configuredAccounts: I.List<string>,

  deviceID: DeviceID,
  deviceName: ?string,
  debugDump: Array<string>,
  error: any,
  extendedConfig: ?ExtendedStatus,
  followers: I.Set<string>,
  following: I.Set<string>,
  globalError: null | Error | RPCError,
  initialState: ?InitialState,
  kbfsPath: string,
  loggedIn: boolean,
  notifySound: boolean,
  openAtLogin: boolean,
  menubarWindowID: number,
  pushLoaded: boolean,
  registered: boolean,
  uid: string,
  userActive: boolean,
  username: string,
  startedDueToPush: boolean,
  version: string,
  versionShort: string,
}
export type State = I.RecordOf<_State>
