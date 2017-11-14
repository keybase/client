// @flow
import uniq from 'lodash/uniq'
import {isMobile, runMode} from './platform'
import {type ConversationIDKey} from './types/chat'
import {type Tab} from './tabs'
import {type Config, type DeviceID, type ExtendedStatus} from './types/flow-types'

export const maxBootstrapTries = 3
export const bootstrapRetryDelay = 10 * 1000
export const defaultKBFSPath = runMode === 'prod' ? '/keybase' : `/keybase.${runMode}`
export const defaultPrivatePrefix = '/private/'
export const defaultPublicPrefix = '/public/'
const defaultTeamPrefix = '/team/'
// Mobile is ready for bootstrap automatically, desktop needs to wait for
// the installer.
const readyForBootstrap = isMobile

export type InitialState = {|
  conversation?: ConversationIDKey,
  tab?: Tab,
  url?: string,
|}

export type BootStatus = 'bootStatusLoading' | 'bootStatusBootstrapped' | 'bootStatusFailure'

export function privateFolderWithUsers(users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
}

export function publicFolderWithUsers(users: Array<string>): string {
  return `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
}

export function teamFolder(team: string): string {
  return `${defaultKBFSPath}${defaultTeamPrefix}${team}`
}

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

export const initialState: State = {
  appFocused: true,
  appFocusedCount: 0,
  bootStatus: 'bootStatusLoading',
  bootstrapTriesRemaining: maxBootstrapTries,
  config: null,
  daemonError: null,
  deviceID: null,
  deviceName: null,
  error: null,
  extendedConfig: null,
  followers: {},
  following: {},
  globalError: null,
  initialState: null,
  kbfsPath: defaultKBFSPath,
  loggedIn: false,
  pushLoaded: false,
  readyForBootstrap,
  registered: false,
  uid: null,
  userActive: true,
  username: null,
}
