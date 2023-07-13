import * as ConfigGen from '../actions/config-gen'
import * as ProvisionConstants from './provision'
import * as RPCTypes from './types/rpc-gen'
import * as Stats from '../engine/stats'
import * as Z from '../util/zustand'
import logger from '../logger'
import type * as Types from './types/config'
import type {ConversationIDKey} from './types/chat2'
import {type CommonResponseHandler} from '../engine/types'
import type {Tab} from './tabs'
import uniq from 'lodash/uniq'
import {RPCError, convertToError, isEOFError, isErrorTransient, niceError} from '../util/errors'
import {defaultUseNativeFrame, runMode, isMobile} from './platform'
import {enableActionLogging} from '../local-debug'
import {noConversationIDKey} from './types/chat2/common'
import {useCurrentUserState} from './current-user'

const ignorePromise = (f: Promise<void>) => {
  f.then(() => {}).catch(() => {})
}

const timeoutPromise = async (timeMs: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), timeMs)
  })

export const loginAsOtherUserWaitingKey = 'config:loginAsOther'
export const createOtherAccountWaitingKey = 'config:createOther'
export const loginWaitingKey = 'login:waiting'
// An ugly error message from the service that we'd like to rewrite ourselves.
export const invalidPasswordErrorString = 'Bad password: Invalid password. Server rejected login attempt..'

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

export type Store = {
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
  loginError?: RPCError
  httpSrv: {
    address: string
    token: string
  }
  incomingShareUseOriginal?: boolean
  isOnline: boolean
  justDeletedSelf: string
  justRevokedSelf: string
  loggedIn: boolean
  logoutHandshakeVersion: number
  logoutHandshakeWaiters: Map<string, number>
  notifySound: boolean
  openAtLogin: boolean
  outOfDate: Types.OutOfDate
  remoteWindowNeedsProps: Map<string, Map<string, number>>
  runtimeStats?: RPCTypes.RuntimeStats
  startup: {
    loaded: boolean
    wasFromPush: boolean
    conversation: ConversationIDKey
    pushPayload: string
    followUser: string
    link: string
    tab?: Tab
  }
  useNativeFrame: boolean
  userSwitching: boolean
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

const initialStore: Store = {
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
  isOnline: false,
  justDeletedSelf: '',
  justRevokedSelf: '',
  loggedIn: false,
  loginError: undefined,
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
  remoteWindowNeedsProps: new Map(),
  startup: {
    conversation: noConversationIDKey,
    followUser: '',
    link: '',
    loaded: false,
    pushPayload: '',
    wasFromPush: false,
  },
  useNativeFrame: defaultUseNativeFrame,
  userSwitching: false,
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

type State = Store & {
  dispatch: {
    changedFocus: (f: boolean) => void
    checkForUpdate: () => void
    filePickerError: (error: Error) => void
    initAppUpdateLoop: () => void
    initNotifySound: () => void
    initOpenAtLogin: () => void
    initUseNativeFrame: () => void
    loadIsOnline: () => void
    login: (username: string, password: string) => void
    loginError: (error?: RPCError) => void
    onFilePickerErrorNative: (error: Error) => void
    resetState: () => void
    remoteWindowNeedsProps: (component: string, params: string) => void
    resetRevokedSelf: () => void
    revoke: (deviceName: string) => void
    setAccounts: (a: Store['configuredAccounts']) => void
    setAllowAnimatedEmojis: (a: boolean) => void
    setAndroidShare: (s: Store['androidShare']) => void
    setDefaultUsername: (u: string) => void
    setGlobalError: (e?: any) => void
    setHTTPSrvInfo: (address: string, token: string) => void
    setIncomingShareUseOriginal: (use: boolean) => void
    setJustDeletedSelf: (s: string) => void
    setLoggedIn: (l: boolean, causedByStartup?: boolean, skipSideEffect?: boolean) => void
    setNotifySound: (n: boolean) => void
    setStartupDetails: (st: Omit<Store['startup'], 'loaded'>) => void
    setStartupDetailsLoaded: () => void
    setOpenAtLogin: (open: boolean) => void
    setOutOfDate: (outOfDate: Types.OutOfDate) => void
    setUserSwitching: (sw: boolean) => void
    setUseNativeFrame: (use: boolean) => void
    setWindowIsMax: (m: boolean) => void
    toggleRuntimeStats: () => void
    updateApp: () => void
    updateRuntimeStats: (stats?: RPCTypes.RuntimeStats) => void
    updateWindowState: (ws: Omit<Store['windowState'], 'isMaximized'>) => void
    windowShown: (win: string) => void
  }
}

export const useConfigState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()

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

  const dispatch: State['dispatch'] = {
    changedFocus: f => {
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
    filePickerError: error => {
      get().dispatch.onFilePickerErrorNative(error)
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
    loadIsOnline: () => {
      const f = async () => {
        try {
          const isOnline = await RPCTypes.loginIsOnlineRpcPromise(undefined)
          set(s => {
            s.isOnline = isOnline
          })
        } catch (err) {
          logger.warn('Error in checking whether we are online', err)
        }
      }
      Z.ignorePromise(f())
    },
    login: (username, passphrase) => {
      const cancelDesc = 'Canceling RPC'
      const cancelOnCallback = (_: unknown, response: CommonResponseHandler) => {
        response.error({code: RPCTypes.StatusCode.scgeneric, desc: cancelDesc})
      }
      const ignoreCallback = () => {}
      const f = async () => {
        try {
          await RPCTypes.loginLoginRpcListener(
            {
              customResponseIncomingCallMap: {
                'keybase.1.gpgUi.selectKey': cancelOnCallback,
                'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
                'keybase.1.provisionUi.DisplayAndPromptSecret': cancelOnCallback,
                'keybase.1.provisionUi.PromptNewDeviceName': (_, response) => {
                  cancelOnCallback(undefined, response)
                  ProvisionConstants.useState.getState().dispatch.setUsername(username)
                },
                'keybase.1.provisionUi.chooseDevice': cancelOnCallback,
                'keybase.1.provisionUi.chooseGPGMethod': cancelOnCallback,
                'keybase.1.secretUi.getPassphrase': (params, response) => {
                  if (params.pinentry.type === RPCTypes.PassphraseType.passPhrase) {
                    // Service asking us again due to a bad passphrase?
                    if (params.pinentry.retryLabel) {
                      cancelOnCallback(params, response)
                      let retryLabel = params.pinentry.retryLabel
                      if (retryLabel === invalidPasswordErrorString) {
                        retryLabel = 'Incorrect password.'
                      }
                      const error = new RPCError(retryLabel, RPCTypes.StatusCode.scinputerror)
                      get().dispatch.loginError(error)
                    } else {
                      response.result({passphrase, storeSecret: false})
                    }
                  } else {
                    cancelOnCallback(params, response)
                  }
                },
              },
              // cancel if we get any of these callbacks, we're logging in, not provisioning
              incomingCallMap: {
                'keybase.1.loginUi.displayPrimaryPaperKey': ignoreCallback,
                'keybase.1.provisionUi.DisplaySecretExchanged': ignoreCallback,
                'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
                'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
              },
              params: {
                clientType: RPCTypes.ClientType.guiMain,
                deviceName: '',
                deviceType: isMobile ? 'mobile' : 'desktop',
                doUserSwitch: true,
                paperKey: '',
                username,
              },
              waitingKey: loginWaitingKey,
            },
            Z.dummyListenerApi
          )
          logger.info('login call succeeded')
          get().dispatch.setLoggedIn(true, false)
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          if (error.code === RPCTypes.StatusCode.scalreadyloggedin) {
            get().dispatch.setLoggedIn(true, false)
          } else if (error.desc !== cancelDesc) {
            // If we're canceling then ignore the error
            error.desc = niceError(error)
            get().dispatch.loginError(error)
          }
        }
      }
      get().dispatch.loginError()
      Z.ignorePromise(f())
    },
    loginError: error => {
      set(s => {
        s.loginError = error
      })
      // On login error, turn off the user switching flag, so that the login screen is not
      // hidden and the user can see and respond to the error.
      get().dispatch.setUserSwitching(false)
    },
    onFilePickerErrorNative: () => {
      // override this
    },
    remoteWindowNeedsProps: (component, params) => {
      set(s => {
        const map = s.remoteWindowNeedsProps.get(component) ?? new Map<string, number>()
        map.set(params, (map.get(params) ?? 0) + 1)
        s.remoteWindowNeedsProps.set(component, map)
      })
    },
    resetRevokedSelf: () => {
      set(s => {
        s.justRevokedSelf = ''
      })
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        appFocused: s.appFocused,
        configuredAccounts: s.configuredAccounts,
        defaultUsername: s.defaultUsername,
        dispatch: {
          ...s.dispatch,
          onFilePickerErrorNative: s.dispatch.onFilePickerErrorNative,
        },
        startup: {loaded: s.startup.loaded},
        useNativeFrame: s.useNativeFrame,
        userSwitching: s.userSwitching,
      }))
    },
    revoke: name => {
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
    setAccounts: a => {
      set(s => {
        s.configuredAccounts = a
      })
    },
    setAllowAnimatedEmojis: a => {
      set(s => {
        s.allowAnimatedEmojis = a
      })
    },
    setAndroidShare: share => {
      set(s => {
        s.androidShare = share
      })
    },
    setDefaultUsername: u => {
      set(s => {
        s.defaultUsername = u
      })
    },
    setGlobalError: _e => {
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
    setHTTPSrvInfo: (address, token) => {
      logger.info(`config reducer: http server info: addr: ${address} token: ${token}`)
      set(s => {
        s.httpSrv.address = address
        s.httpSrv.token = token
      })
    },
    setIncomingShareUseOriginal: use => {
      set(s => {
        s.incomingShareUseOriginal = use
      })
    },
    setJustDeletedSelf: self => {
      set(s => {
        s.justDeletedSelf = self
      })
    },
    setLoggedIn: (l, causedByStartup = false, skipSideEffect = false) => {
      if (l === get().loggedIn) {
        return
      }
      set(s => {
        s.loggedIn = l
      })
      if (!skipSideEffect) {
        reduxDispatch(ConfigGen.createLoggedInChanged({causedByStartup}))
      }
    },
    setNotifySound: n => {
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
    setOpenAtLogin: open => {
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
    setOutOfDate: outOfDate => {
      set(s => {
        s.outOfDate = outOfDate
      })
    },
    setStartupDetails: st => {
      set(s => {
        if (s.startup.loaded) {
          return
        }
        s.startup = {
          ...st,
          loaded: true,
        }
      })
    },
    setStartupDetailsLoaded: () => {
      set(s => {
        s.startup.loaded = true
      })
    },
    setUseNativeFrame: use => {
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
    setUserSwitching: sw => {
      set(s => {
        s.userSwitching = sw
      })
    },
    setWindowIsMax: m => {
      set(s => {
        s.windowState.isMaximized = m
      })
    },
    toggleRuntimeStats: () => {
      const f = async () => {
        await RPCTypes.configToggleRuntimeStatsRpcPromise()
      }
      ignorePromise(f())
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
    updateRuntimeStats: stats => {
      set(s => {
        if (!stats) {
          s.runtimeStats = stats
        } else {
          s.runtimeStats = {
            ...s.runtimeStats,
            ...stats,
          }
        }
      })
    },
    updateWindowState: ws => {
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
    windowShown: win => {
      set(s => {
        s.windowShownCount.set(win, (s.windowShownCount.get(win) ?? 0) + 1)
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})

export {useDaemonState, maxHandshakeTries} from './daemon'
export {useFollowerState} from './followers'
export {useLogoutState} from './logout'
export {useActiveState} from './active'
export {useCurrentUserState}
