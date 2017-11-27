// @flow
import {type ConversationIDKey} from './chat'
import {type Tab} from '../tabs'
import {type Config, type DeviceID, type ExtendedStatus} from './flow-types'

export type InitialState = {|
  conversation?: ConversationIDKey,
  tab?: Tab,
  url?: string,
|}

export type BootStatus = 'bootStatusLoading' | 'bootStatusBootstrapped' | 'bootStatusFailure'
// NOTE: All stores which go over the wire to remote windows CANNOT be immutable (yet)
export type State = {
  appFocused: boolean,
  appFocusedCount: number,
  bootStatus: BootStatus,
  bootstrapTriesRemaining: number,
  config: ?Config,
  daemonError: ?Error,
  deviceID: ?DeviceID,
  deviceName: ?string,
  error: ?any,
  extendedConfig: ?ExtendedStatus,
  followers: {[key: string]: true},
  following: {[key: string]: true},
  globalError: ?Error,
  initialState: ?InitialState,
  kbfsPath: string,
  loggedIn: boolean,
  pushLoaded: boolean,
  readyForBootstrap: boolean,
  registered: boolean,
  uid: ?string,
  userActive: boolean,
  username: ?string,
}
