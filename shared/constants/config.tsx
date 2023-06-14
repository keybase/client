import * as ConfigGen from '../actions/config-gen'
import type {RPCError} from '../util/errors'
import HiddenString from '../util/hidden-string'
import * as RPCTypes from './types/rpc-gen'
import type * as Types from './types/config'
import uniq from 'lodash/uniq'
import {defaultUseNativeFrame, runMode} from './platform'
import {noConversationIDKey} from './types/chat2/common'
// normally util.container but it re-exports from us so break the cycle
import {create as createZustand} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'
import {getReduxDispatch} from '../util/zustand'
import {enableActionLogging} from '../local-debug'
import logger from '../logger'
import {convertToError, isEOFError, isErrorTransient} from '../util/errors'
import {useCurrentUserState} from './current-user'
import * as Stats from '../engine/stats'

const ignorePromise = (f: Promise<void>) => {
  f.then(() => {}).catch(() => {})
}

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
  loggedIn: false,
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
  userActive: true,
  userSwitching: false,
  whatsNewLastSeenVersion: '',
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
  globalError?: Error | RPCError
  httpSrv: {
    address: string
    token: string
  }
  incomingShareUseOriginal?: boolean
  justDeletedSelf: string
  justRevokedSelf: string
  logoutHandshakeVersion: number
  logoutHandshakeWaiters: Map<string, number>
  useNativeFrame: boolean
  windowShownCount: Map<string, number>
  windowState: {
    dockHidden: boolean
    height: number
    isFullScreen: boolean
    isMaximized: boolean
    width: number
    windowHidden: boolean
    x: number
    y: number
  }
}

const initialZState: ZStore = {
  allowAnimatedEmojis: true,
  androidShare: undefined,
  appFocused: true,
  configuredAccounts: [],
  defaultUsername: '',
  globalError: undefined,
  httpSrv: {
    address: '',
    token: '',
  },
  incomingShareUseOriginal: undefined,
  justDeletedSelf: '',
  justRevokedSelf: '',
  logoutHandshakeVersion: 1,
  logoutHandshakeWaiters: new Map(),
  useNativeFrame: defaultUseNativeFrame,
  windowShownCount: new Map(),
  windowState: {
    dockHidden: false,
    height: 800,
    isFullScreen: false,
    isMaximized: false,
    width: 600,
    windowHidden: false,
    x: 0,
    y: 0,
  },
}

type ZState = ZStore & {
  dispatch: {
    reset: () => void
    setAllowAnimatedEmojis: (a: boolean) => void
    setAndroidShare: (s: ZStore['androidShare']) => void
    changedFocus: (f: boolean) => void
    resetRevokedSelf: () => void
    revoke: (deviceName: string) => void
    setAccounts: (a: ZStore['configuredAccounts']) => void
    setDefaultUsername: (u: string) => void
    setGlobalError: (e?: any) => void
    setHTTPSrvInfo: (address: string, token: string) => void
    setIncomingShareUseOriginal: (use: boolean) => void
    setJustDeletedSelf: (s: string) => void
    setWindowIsMax: (m: boolean) => void
    updateWindowState: (ws: Omit<ZStore['windowState'], 'isMaximized'>) => void
    windowShown: (win: string) => void
    setUseNativeFrame: (use: boolean) => void
    initUseNativeFrame: () => void
  }
}

export const useConfigState = createZustand(
  immerZustand<ZState>((set, get) => {
    const reduxDispatch = getReduxDispatch()

    const nativeFrameKey = 'useNativeFrame'
    const dispatch = {
      changedFocus: (f: boolean) => {
        set(s => {
          s.appFocused = f
        })
        reduxDispatch(ConfigGen.createChangedFocus({appFocused: f}))
      },
      initUseNativeFrame: () => {
        const f = async () => {
          const val = await RPCTypes.configGuiGetValueRpcPromise({path: nativeFrameKey})
          const useNativeFrame = val.b === undefined || val.b === null ? defaultUseNativeFrame : val.b
          set(s => {
            s.useNativeFrame = useNativeFrame
          })
        }
        ignorePromise(f())
      },
      reset: () => {
        set(s => ({
          ...initialZState,
          appFocused: s.appFocused,
          configuredAccounts: s.configuredAccounts,
          defaultUsername: s.defaultUsername,
          useNativeFrame: s.useNativeFrame,
        }))
      },
      resetRevokedSelf: () => {
        set(s => {
          s.justRevokedSelf = ''
        })
      },
      revoke: (name: string) => {
        const wasCurrentDevice = useCurrentUserState.getState().deviceName === name
        if (wasCurrentDevice) {
          const {configuredAccounts, defaultUsername} = get()
          const acc = configuredAccounts.find(n => n.username !== defaultUsername)
          const du = acc?.username ?? ''
          set(s => {
            s.defaultUsername = du
            s.justRevokedSelf = name
          })
        }
        reduxDispatch(ConfigGen.createRevoked())
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
      setGlobalError: (_e?: Error | RPCError) => {
        const e = convertToError(_e)
        if (e) {
          logger.error('Error (global):', e)
          if (isEOFError(e)) {
            Stats.gotEOF()
          }
          if (isErrorTransient(e)) {
            logger.info('globalError silencing:', e)
            return
          }
          if (enableActionLogging) {
            const payload = {err: `Global Error: ${e.message} ${e.stack ?? ''}`}
            logger.action({payload, type: 'config:globalError'})
          }
        }
        set(s => {
          s.globalError = e
        })
      },
      setHTTPSrvInfo: (address: string, token: string) => {
        logger.info(`config reducer: http server info: addr: ${address} token: ${token}`)
        set(s => {
          s.httpSrv.address = address
          s.httpSrv.token = token
        })
      },
      setIncomingShareUseOriginal: (use: boolean) => {
        set(s => {
          s.incomingShareUseOriginal = use
        })
      },
      setJustDeletedSelf: (self: string) => {
        set(s => {
          s.justDeletedSelf = self
        })
      },
      setUseNativeFrame: (use: boolean) => {
        set(s => {
          s.useNativeFrame = use
        })
        ignorePromise(
          RPCTypes.configGuiSetValueRpcPromise({
            path: nativeFrameKey,
            value: {
              b: use,
              isNull: false,
            },
          })
        )
      },
      setWindowIsMax: (m: boolean) => {
        set(s => {
          s.windowState.isMaximized = m
        })
      },
      updateWindowState: (ws: Omit<ZStore['windowState'], 'isMaximized'>) => {
        const next = {...get().windowState, ...ws}
        set(s => {
          s.windowState = next
        })

        const windowStateKey = 'windowState'
        ignorePromise(
          RPCTypes.configGuiSetValueRpcPromise({
            path: windowStateKey,
            value: {
              isNull: false,
              s: JSON.stringify(next),
            },
          })
        )
      },
      windowShown: (win: string) => {
        set(s => {
          s.windowShownCount.set(win, (s.windowShownCount.get(win) ?? 0) + 1)
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
export {useLogoutState} from './logout'
export {useCurrentUserState}
