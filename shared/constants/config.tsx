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

const timeoutPromise = async (timeMs: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), timeMs)
  })

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
  notifySound: boolean
  openAtLogin: boolean
  outOfDate: Types.OutOfDate
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
  notifySound: false,
  openAtLogin: true,
  outOfDate: {
    critical: false,
    message: '',
    outOfDate: false,
    updating: false,
  },
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
    changedFocus: (f: boolean) => void
    checkForUpdate: () => void
    initAppUpdateLoop: () => void
    initNotifySound: () => void
    initOpenAtLogin: () => void
    initUseNativeFrame: () => void
    reset: () => void
    resetRevokedSelf: () => void
    revoke: (deviceName: string) => void
    setAccounts: (a: ZStore['configuredAccounts']) => void
    setAllowAnimatedEmojis: (a: boolean) => void
    setAndroidShare: (s: ZStore['androidShare']) => void
    setDefaultUsername: (u: string) => void
    setGlobalError: (e?: any) => void
    setHTTPSrvInfo: (address: string, token: string) => void
    setIncomingShareUseOriginal: (use: boolean) => void
    setJustDeletedSelf: (s: string) => void
    setNotifySound: (n: boolean) => void
    setOpenAtLogin: (open: boolean) => void
    setOutOfDate: (outOfDate: Types.OutOfDate) => void
    setUseNativeFrame: (use: boolean) => void
    setWindowIsMax: (m: boolean) => void
    updateApp: () => void
    updateWindowState: (ws: Omit<ZStore['windowState'], 'isMaximized'>) => void
    windowShown: (win: string) => void
  }
}

export const useConfigState = createZustand(
  immerZustand<ZState>((set, get) => {
    const reduxDispatch = getReduxDispatch()

    const nativeFrameKey = 'useNativeFrame'
    const notifySoundKey = 'notifySound'
    const openAtLoginKey = 'openAtLogin'

    const _checkForUpdate = async () => {
      try {
        const {status, message} = await RPCTypes.configGetUpdateInfoRpcPromise()
        get().dispatch.setOutOfDate(
          status !== RPCTypes.UpdateInfoStatus.upToDate
            ? {
                critical: status === RPCTypes.UpdateInfoStatus.criticallyOutOfDate,
                message,
                outOfDate: true,
                updating: false,
              }
            : {
                critical: false,
                message: '',
                outOfDate: false,
                updating: false,
              }
        )
      } catch (err) {
        logger.warn('error getting update info: ', err)
      }
    }

    const dispatch = {
      changedFocus: (f: boolean) => {
        set(s => {
          s.appFocused = f
        })
        reduxDispatch(ConfigGen.createChangedFocus({appFocused: f}))
      },
      checkForUpdate: () => {
        const f = async () => {
          await _checkForUpdate()
        }
        ignorePromise(f())
      },
      initAppUpdateLoop: () => {
        const f = async () => {
          // eslint-disable-next-line
          while (true) {
            try {
              await _checkForUpdate()
            } catch {}
            await timeoutPromise(3_600_000) // 1 hr
          }
        }
        ignorePromise(f())
      },
      initNotifySound: () => {
        const f = async () => {
          const val = await RPCTypes.configGuiGetValueRpcPromise({path: notifySoundKey})
          const notifySound = val.b
          if (typeof notifySound === 'boolean') {
            set(s => {
              s.notifySound = notifySound
            })
          }
        }
        ignorePromise(f())
      },
      initOpenAtLogin: () => {
        const f = async () => {
          const val = await RPCTypes.configGuiGetValueRpcPromise({path: openAtLoginKey})
          const openAtLogin = val.b
          if (typeof openAtLogin === 'boolean') {
            get().dispatch.setOpenAtLogin(openAtLogin)
          }
        }
        ignorePromise(f())
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
      setNotifySound: (n: boolean) => {
        set(s => {
          s.notifySound = n
        })
        ignorePromise(
          RPCTypes.configGuiSetValueRpcPromise({
            path: notifySoundKey,
            value: {
              b: n,
              isNull: false,
            },
          })
        )
      },
      setOpenAtLogin: (open: boolean) => {
        set(s => {
          s.openAtLogin = open
        })
        const f = async () => {
          await RPCTypes.configGuiSetValueRpcPromise({
            path: openAtLoginKey,
            value: {b: open, isNull: false},
          })
          if (__DEV__) {
            console.log('onSetOpenAtLogin disabled for dev mode')
            return
          }
          reduxDispatch(ConfigGen.createOpenAtLoginChanged())
        }
        ignorePromise(f())
      },
      setOutOfDate: (outOfDate: Types.OutOfDate) => {
        set(s => {
          s.outOfDate = outOfDate
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
      updateApp: () => {
        const f = async () => {
          await RPCTypes.configStartUpdateIfNeededRpcPromise()
        }
        ignorePromise(f())
        // * If user choose to update:
        //   We'd get killed and it doesn't matter what happens here.
        // * If user hits "Ignore":
        //   Note that we ignore the snooze here, so the state shouldn't change,
        //   and we'd back to where we think we still need an update. So we could
        //   have just unset the "updating" flag.However, in case server has
        //   decided to pull out the update between last time we asked the updater
        //   and now, we'd be in a wrong state if we didn't check with the service.
        //   Since user has interacted with it, we still ask the service to make
        //   sure.
        set(s => {
          s.outOfDate.updating = true
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
