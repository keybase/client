// @flow
import * as I from 'immutable'
import {type ConversationIDKey} from './chat'
import {type Tab} from '../tabs'
import {type Config, type DeviceID, type ExtendedStatus} from './rpc-gen'

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
  avatars: {[username: string]: AvatarSizes},
  bootStatus: BootStatus,
  bootstrapTriesRemaining: number,
  config: ?Config,
  daemonError: ?Error,
  deviceID: ?DeviceID,
  deviceName: ?string,
  error: ?any,
  extendedConfig: ?ExtendedStatus,
  followers: I.Set<string>,
  following: I.Set<string>,
  globalError: ?Error,
  initialState: ?InitialState,
  kbfsPath: string,
  loggedIn: boolean,
  menubarWindowID: number,
  pushLoaded: boolean,
  readyForBootstrap: boolean,
  registered: boolean,
  uid: ?string,
  userActive: boolean,
  username: ?string,
}
export type State = I.RecordOf<_State>
