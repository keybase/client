import uniq from 'lodash/uniq'
import type * as RPCTypes from './types/rpc-gen'
import type * as Types from './types/config'
import {noConversationIDKey} from './types/chat2/common'
import * as ConfigGen from '../actions/config-gen'
import HiddenString from '../util/hidden-string'
import {defaultUseNativeFrame, runMode} from './platform'
import {isDarkMode as _isDarkMode} from '../styles/dark-mode'
// normally util.container but it re-exports from us so break the cycle
import {create as createZustand} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'
import {getReduxDispatch} from '../util/zustand'
import logger from '../logger'

export const loginAsOtherUserWaitingKey = 'config:loginAsOther'
export const createOtherAccountWaitingKey = 'config:createOther'

export const maxHandshakeTries = 3
export const defaultKBFSPath = runMode === 'prod' ? '/keybase' : `/keybase.${runMode}`
export const defaultPrivatePrefix = '/private/'
export const defaultPublicPrefix = '/public/'
export const noKBFSFailReason = "Can't connect to KBFS"
const defaultTeamPrefix = '/team/'

export const privateFolderWithUsers = (users: Array<string>) =>
  `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
export const publicFolderWithUsers = (users: Array<string>) =>
  `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
export const teamFolder = (team: string) => `${defaultKBFSPath}${defaultTeamPrefix}${team}`

export const initialState: Types.State = {
  daemonHandshakeVersion: 1,
  daemonHandshakeWaiters: new Map(),
  darkModePreference: 'system',
  deviceID: '',
  deviceName: '',
  followers: new Set(),
  following: new Set(),
  httpSrvAddress: '',
  httpSrvToken: '',
  incomingShareUseOriginal: undefined,
  justDeletedSelf: '',
  justRevokedSelf: '',
  loggedIn: false,
  logoutHandshakeVersion: 1,
  logoutHandshakeWaiters: new Map(),
  mainWindowMax: false,
  notifySound: false,
  openAtLogin: true,
  osNetworkOnline: false,
  outOfDate: undefined,
  pushLoaded: false,
  registered: false,
  remoteWindowNeedsProps: new Map(),
  startupConversation: noConversationIDKey,
  startupDetailsLoaded: false,
  startupFile: new HiddenString(''),
  startupFollowUser: '',
  startupLink: '',
  startupPushPayload: undefined,
  startupWasFromPush: false,
  systemDarkMode: false,
  uid: '',
  useNativeFrame: defaultUseNativeFrame,
  userActive: true,
  userSwitching: false,
  username: '',
  whatsNewLastSeenVersion: '',
  windowShownCount: new Map(),
  windowState: {
    dockHidden: false,
    height: 800,
    isFullScreen: false,
    width: 600,
    windowHidden: false,
    x: 0,
    y: 0,
  },
}

// we proxy the style helper to keep the logic in one place but act like a selector
export const isDarkMode = (_: Types.State) => _isDarkMode()

export type ZStore = {
  allowAnimatedEmojis: boolean
  androidShare?:
    | {
        type: RPCTypes.IncomingShareType.file
        url: string
      }
    | {
        type: RPCTypes.IncomingShareType.text
        text: string
      }
  appFocused: boolean
  configuredAccounts: Array<Types.ConfiguredAccount>
  defaultUsername: string
  daemonError?: Error
  daemonHandshakeState: Types.DaemonHandshakeState
  daemonHandshakeFailedReason: string
  daemonHandshakeRetriesLeft: number
}
const initialZState: ZStore = {
  allowAnimatedEmojis: true,
  appFocused: true,
  configuredAccounts: [],
  daemonHandshakeFailedReason: '',
  daemonHandshakeRetriesLeft: maxHandshakeTries,
  daemonHandshakeState: 'starting',
  defaultUsername: '',
}

type ZState = ZStore & {
  dispatch: {
    daemon: {
      setError: (e?: Error) => void
      setState: (s: Types.DaemonHandshakeState) => void
      setFailed: (r: string) => void
      retriesDecrement: () => void
      retriesReset: (failed: boolean) => void
    }
    reset: () => void
    setAllowAnimatedEmojis: (a: boolean) => void
    setAndroidShare: (s: ZStore['androidShare']) => void
    changedFocus: (f: boolean) => void
    setAccounts: (a: ZStore['configuredAccounts']) => void
    setDefaultUsername: (u: string) => void
  }
}

export const useConfigState = createZustand(
  immerZustand<ZState>(set => {
    const reduxDispatch = getReduxDispatch()

    const dispatch = {
      changedFocus: (f: boolean) => {
        set(s => {
          s.appFocused = f
        })
        reduxDispatch(ConfigGen.createChangedFocus({appFocused: f}))
      },
      daemon: {
        retriesDecrement: () => {
          set(s => {
            s.daemonHandshakeRetriesLeft = Math.max(0, s.daemonHandshakeRetriesLeft - 1)
          })
        },
        retriesReset: (failed: boolean) => {
          set(s => {
            s.daemonHandshakeRetriesLeft = failed ? 0 : maxHandshakeTries
          })
        },
        setError: (e?: Error) => {
          if (e) {
            logger.error('Error (daemon):', e)
          }
          set(s => {
            s.daemonError = e
          })
        },
        setFailed: (r: string) => {
          set(s => {
            s.daemonHandshakeFailedReason = r
          })
        },
        setState: (ds: Types.DaemonHandshakeState) => {
          set(s => {
            s.daemonHandshakeState = ds
          })
        },
      },
      reset: () => {
        set(s => ({
          ...initialState,
          appFocused: s.appFocused,
          configuredAccounts: s.configuredAccounts,
          daemonHandshakeState: s.daemonHandshakeState,
          defaultUsername: s.defaultUsername,
        }))
      },
      setAccounts: (a: ZStore['configuredAccounts']) => {
        set(s => {
          s.configuredAccounts = a
        })
      },
      setAllowAnimatedEmojis: (a: boolean) => {
        set(s => {
          s.allowAnimatedEmojis = a
        })
      },
      setAndroidShare: (share: ZStore['androidShare']) => {
        set(s => {
          s.androidShare = share
        })
      },
      setDefaultUsername: (u: string) => {
        set(s => {
          s.defaultUsername = u
        })
      },
    }

    return {
      ...initialZState,
      dispatch,
    }
  })
)
