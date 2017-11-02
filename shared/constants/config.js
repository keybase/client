// @flow
import uniq from 'lodash/uniq'
import {runMode} from './platform'
import {type ConversationIDKey} from './chat'
import {type Tab} from './tabs'
import {type Config, type DeviceID, type ExtendedStatus} from './types/flow-types'

const maxBootstrapTries = 3
const bootstrapRetryDelay = 10 * 1000
const defaultKBFSPath = runMode === 'prod' ? '/keybase' : `/keybase.${runMode}`
const defaultPrivatePrefix = '/private/'
const defaultPublicPrefix = '/public/'
const defaultTeamPrefix = '/team/'

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

export {maxBootstrapTries, bootstrapRetryDelay, defaultKBFSPath, defaultPrivatePrefix, defaultPublicPrefix}
