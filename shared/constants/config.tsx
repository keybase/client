import * as ConfigGen from '../actions/config-gen'
import HiddenString from '../util/hidden-string'
import type * as RPCTypes from './types/rpc-gen'
import type * as Types from './types/config'
import uniq from 'lodash/uniq'
import {defaultUseNativeFrame, runMode} from './platform'
import {noConversationIDKey} from './types/chat2/common'
// normally util.container but it re-exports from us so break the cycle
import {create as createZustand} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'
import {getReduxDispatch} from '../util/zustand'

export const loginAsOtherUserWaitingKey = 'config:loginAsOther'
export const createOtherAccountWaitingKey = 'config:createOther'

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
  remoteWindowNeedsProps: new Map(),
  startupConversation: noConversationIDKey,
  startupDetailsLoaded: false,
  startupFile: new HiddenString(''),
  startupFollowUser: '',
  startupLink: '',
  startupPushPayload: undefined,
  startupWasFromPush: false,
  useNativeFrame: defaultUseNativeFrame,
  userActive: true,
  userSwitching: false,
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
  deviceID: RPCTypes.DeviceID
  deviceName: string
  uid: string
  username: string
}

const initialZState: ZStore = {
  allowAnimatedEmojis: true,
  appFocused: true,
  configuredAccounts: [],
  defaultUsername: '',
  deviceID: '',
  deviceName: '',
  uid: '',
  username: '',
}

type Bootstrap = {
  deviceID: string
  deviceName: string
  uid: string
  username: string
}

type ZState = ZStore & {
  dispatch: {
    reset: () => void
    setAllowAnimatedEmojis: (a: boolean) => void
    setAndroidShare: (s: ZStore['androidShare']) => void
    changedFocus: (f: boolean) => void
    // ONLY used by remote windows
    replaceUsername: (u: string) => void
    setAccounts: (a: ZStore['configuredAccounts']) => void
    setDefaultUsername: (u: string) => void
    setBootstrap: (b: Bootstrap) => void
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
      replaceUsername: (u: string) => {
        set(s => {
          s.username = u
        })
      },
      reset: () => {
        set(s => ({
          ...initialZState,
          appFocused: s.appFocused,
          configuredAccounts: s.configuredAccounts,
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
      setBootstrap: (b: Bootstrap) => {
        set(s => {
          const {deviceID, deviceName, uid, username} = b
          s.deviceID = deviceID
          s.deviceName = deviceName
          s.uid = uid
          s.username = username
          if (username) {
            s.defaultUsername = username
          }
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

export {useDaemonState, maxHandshakeTries} from './daemon'
export {useFollowerState} from './followers'
