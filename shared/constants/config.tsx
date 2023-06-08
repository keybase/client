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
  configuredAccounts: [],
  daemonHandshakeFailedReason: '',
  daemonHandshakeRetriesLeft: maxHandshakeTries,
  daemonHandshakeState: 'starting',
  daemonHandshakeVersion: 1,
  daemonHandshakeWaiters: new Map(),
  darkModePreference: 'system',
  defaultUsername: '',
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
}
const initialZState: ZStore = {
  allowAnimatedEmojis: true,
  appFocused: true,
}

type ZState = ZStore & {
  dispatchReset: () => void
  dispatchSetAllowAnimtedEmojis: (a: boolean) => void
  dispatchSetAndroidShare: (s: ZStore['androidShare']) => void
  dispatchChangedFocus: (f: boolean) => void
}

export const useConfigState = createZustand(
  immerZustand<ZState>(set => {
    const reduxDispatch = getReduxDispatch()

    const dispatchReset = () => {
      set(s => ({
        ...initialState,
        appFocused: s.appFocused,
      }))
    }

    const dispatchSetAllowAnimtedEmojis = (a: boolean) => {
      set(s => {
        s.allowAnimatedEmojis = a
      })
    }

    const dispatchSetAndroidShare = (share: ZStore['androidShare']) => {
      set(s => {
        s.androidShare = share
      })
    }

    const dispatchChangedFocus = (f: boolean) => {
      set(s => {
        s.appFocused = f
      })
      reduxDispatch(ConfigGen.createChangedFocus({appFocused: f}))
    }

    return {
      ...initialZState,
      dispatchChangedFocus,
      dispatchReset,
      dispatchSetAllowAnimtedEmojis,
      dispatchSetAndroidShare,
    }
  })
)
