import * as DarkMode from './darkmode'
import * as ProvisionConstants from './provision'
import * as DeviceTypes from './types/devices'
import * as RPCTypes from './types/rpc-gen'
import * as RemoteGen from '../actions/remote-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Stats from '../engine/stats'
import * as Z from '../util/zustand'
import logger from '../logger'
import type * as RPCTypesGregor from './types/rpc-gregor-gen'
import type * as Types from './types/config'
import type {ConversationIDKey} from './types/chat2'
import type {Tab} from './tabs'
import uniq from 'lodash/uniq'
import {RPCError, convertToError, isEOFError, isErrorTransient, niceError} from '../util/errors'
import {defaultUseNativeFrame, runMode, isMobile} from './platform'
import {enableActionLogging} from '../local-debug'
import {noConversationIDKey} from './types/chat2/common'
import {type CommonResponseHandler} from '../engine/types'
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
    | {type: RPCTypes.IncomingShareType.file; url: string}
    | {type: RPCTypes.IncomingShareType.text; text: string}
  appFocused: boolean
  badgeState?: RPCTypes.BadgeState
  configuredAccounts: Array<Types.ConfiguredAccount>
  defaultUsername: string
  globalError?: Error | RPCError
  gregorReachable?: RPCTypes.Reachable
  gregorPushState: Array<{md: RPCTypesGregor.Metadata; item: RPCTypesGregor.Item}>
  loginError?: RPCError
  httpSrv: {
    address: string
    token: string
  }
  incomingShareUseOriginal?: boolean
  installerRanCount: number
  isOnline: boolean
  justDeletedSelf: string
  justRevokedSelf: string
  loggedIn: boolean
  loggedInCausedbyStartup: boolean
  loadOnStartPhase:
    | 'notStarted'
    | 'initialStartupAsEarlyAsPossible'
    | 'connectedToDaemonForFirstTime'
    | 'reloggedIn'
    | 'startupOrReloginButNotInARush'
  mobileAppState: 'active' | 'background' | 'inactive' | 'unknown'
  networkStatus?: {online: boolean; type: Types.ConnectionType; isInit?: boolean}
  notifySound: boolean
  openAtLogin: boolean
  outOfDate: Types.OutOfDate
  remoteWindowNeedsProps: Map<string, Map<string, number>>
  revokedTrigger: number
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
  unlockFoldersDevices: Array<{
    type: DeviceTypes.DeviceType
    name: string
    deviceID: DeviceTypes.DeviceID
  }>
  unlockFoldersError: string
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
  badgeState: undefined,
  configuredAccounts: [],
  defaultUsername: '',
  globalError: undefined,
  gregorPushState: [],
  gregorReachable: undefined,
  httpSrv: {
    address: '',
    token: '',
  },
  incomingShareUseOriginal: undefined,
  installerRanCount: 0,
  isOnline: false,
  justDeletedSelf: '',
  justRevokedSelf: '',
  loadOnStartPhase: 'notStarted',
  loggedIn: false,
  loggedInCausedbyStartup: false,
  loginError: undefined,
  mobileAppState: 'unknown',
  networkStatus: undefined,
  notifySound: false,
  openAtLogin: true,
  outOfDate: {
    critical: false,
    message: '',
    outOfDate: false,
    updating: false,
  },
  remoteWindowNeedsProps: new Map(),
  revokedTrigger: 0,
  startup: {
    conversation: noConversationIDKey,
    followUser: '',
    link: '',
    loaded: false,
    pushPayload: '',
    wasFromPush: false,
  },
  unlockFoldersDevices: [],
  unlockFoldersError: '',
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
    dynamic: {
      copyToClipboard: (s: string) => void
      dumpLogsNative?: (reason: string) => Promise<void>
      onFilePickerError?: (error: Error) => void
      openAppSettings?: () => void
      openAppStore?: () => void
      persistRoute?: (path?: Array<any>) => void
      setNavigatorExistsNative?: () => void
      showMainNative?: () => void
      showShareActionSheet?: (filePath: string, message: string, mimeType: string) => void
    }
    changedFocus: (f: boolean) => void
    checkForUpdate: () => void
    dumpLogs: (reason: string) => Promise<void>
    eventFromRemoteWindows: (action: RemoteGen.Actions) => void
    filePickerError: (error: Error) => void
    initAppUpdateLoop: () => void
    initNotifySound: () => void
    initOpenAtLogin: () => void
    initUseNativeFrame: () => void
    installerRan: () => void
    loadIsOnline: () => void
    loadOnStart: (phase: State['loadOnStartPhase']) => void
    login: (username: string, password: string) => void
    loginError: (error?: RPCError) => void
    logoutAndTryToLogInAs: (username: string) => void
    osNetworkStatusChanged: (online: boolean, type: Types.ConnectionType, isInit?: boolean) => void
    openUnlockFolders: (devices: Array<RPCTypes.Device>) => void
    powerMonitorEvent: (event: string) => void
    resetState: () => void
    remoteWindowNeedsProps: (component: string, params: string) => void
    resetRevokedSelf: () => void
    revoke: (deviceName: string) => void
    setAccounts: (a: Store['configuredAccounts']) => void
    setAllowAnimatedEmojis: (a: boolean) => void
    setAndroidShare: (s: Store['androidShare']) => void
    setBadgeState: (b: State['badgeState']) => void
    setDefaultUsername: (u: string) => void
    setGlobalError: (e?: any) => void
    setGregorReachable: (r: Store['gregorReachable']) => void
    setGregorPushState: (state: RPCTypes.Gregor1.State) => void
    setHTTPSrvInfo: (address: string, token: string) => void
    setIncomingShareUseOriginal: (use: boolean) => void
    setJustDeletedSelf: (s: string) => void
    setLoggedIn: (l: boolean, causedByStartup: boolean) => void
    setMobileAppState: (nextAppState: 'active' | 'background' | 'inactive') => void
    setNavigatorExists: () => void
    setNotifySound: (n: boolean) => void
    setStartupDetails: (st: Omit<Store['startup'], 'loaded'>) => void
    setStartupDetailsLoaded: () => void
    setOpenAtLogin: (open: boolean) => void
    setOutOfDate: (outOfDate: Types.OutOfDate) => void
    setUserSwitching: (sw: boolean) => void
    setUseNativeFrame: (use: boolean) => void
    setWindowIsMax: (m: boolean) => void
    showMain: () => void
    toggleRuntimeStats: () => void
    updateApp: () => void
    updateGregorCategory: (category: string, body: string, dtime?: {offset: number; time: number}) => void
    updateRuntimeStats: (stats?: RPCTypes.RuntimeStats) => void
    updateWindowState: (ws: Omit<Store['windowState'], 'isMaximized'>) => void
    windowShown: (win: string) => void
  }
}

export const openAtLoginKey = 'openAtLogin'
export const useConfigState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()

  const nativeFrameKey = 'useNativeFrame'
  const notifySoundKey = 'notifySound'

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
    },
    checkForUpdate: () => {
      const f = async () => {
        await _checkForUpdate()
      }
      ignorePromise(f())
    },
    dumpLogs: async reason => {
      await get().dispatch.dynamic.dumpLogsNative?.(reason)
    },
    dynamic: {
      copyToClipboard: () => {
        throw new Error('copyToClipboard not implemented?????')
      },
      dumpLogsNative: undefined,
      onFilePickerError: undefined,
      openAppSettings: undefined,
      openAppStore: undefined,
      persistRoute: undefined,
      setNavigatorExistsNative: undefined,
      showMainNative: undefined,
      showShareActionSheet: undefined,
    },
    eventFromRemoteWindows: (action: RemoteGen.Actions) => {
      switch (action.type) {
        case RemoteGen.resetStore:
          break
        case RemoteGen.openFilesFromWidget: {
          const f = async () => {
            const FSConstants = await import('./fs')
            FSConstants.useState.getState().dispatch.dynamic.openFilesFromWidgetDesktop?.(action.payload.path)
          }
          Z.ignorePromise(f())
          break
        }
        case RemoteGen.saltpackFileOpen: {
          const f = async () => {
            const DConstants = await import('./deeplinks')
            DConstants.useState.getState().dispatch.handleSaltPackOpen(action.payload.path)
          }
          Z.ignorePromise(f())
          break
        }
        case RemoteGen.pinentryOnCancel: {
          const f = async () => {
            const PConstants = await import('./pinentry')
            PConstants.useState.getState().dispatch.dynamic.onCancel?.()
          }
          Z.ignorePromise(f())
          break
        }
        case RemoteGen.pinentryOnSubmit: {
          const f = async () => {
            const PConstants = await import('./pinentry')
            PConstants.useState.getState().dispatch.dynamic.onSubmit?.(action.payload.password)
          }
          Z.ignorePromise(f())
          break
        }
        case RemoteGen.openPathInSystemFileManager: {
          const f = async () => {
            const FSConstants = await import('./fs')
            FSConstants.useState
              .getState()
              .dispatch.dynamic.openPathInSystemFileManagerDesktop?.(action.payload.path)
          }
          Z.ignorePromise(f())
          break
        }
        case RemoteGen.unlockFoldersSubmitPaperKey: {
          RPCTypes.loginPaperKeySubmitRpcPromise(
            {paperPhrase: action.payload.paperKey},
            'unlock-folders:waiting'
          )
            .then(() => {
              get().dispatch.openUnlockFolders([])
            })
            .catch(e => {
              set(s => {
                s.unlockFoldersError = e.desc
              })
            })
          break
        }
        case RemoteGen.closeUnlockFolders: {
          RPCTypes.rekeyRekeyStatusFinishRpcPromise()
            .then(() => {})
            .catch(() => {})
          get().dispatch.openUnlockFolders([])
          break
        }
        case RemoteGen.stop: {
          const f = async () => {
            const SettingsConstants = await import('./settings')
            SettingsConstants.useState.getState().dispatch.stop(action.payload.exitCode)
          }
          Z.ignorePromise(f())
          break
        }
        case RemoteGen.trackerChangeFollow: {
          const f = async () => {
            const TrackerConstants = await import('./tracker2')
            TrackerConstants.useState
              .getState()
              .dispatch.changeFollow(action.payload.guiID, action.payload.follow)
          }
          Z.ignorePromise(f())
          break
        }
        case RemoteGen.trackerIgnore: {
          const f = async () => {
            const TrackerConstants = await import('./tracker2')
            TrackerConstants.useState.getState().dispatch.ignore(action.payload.guiID)
          }
          Z.ignorePromise(f())
          break
        }
        case RemoteGen.trackerCloseTracker: {
          const f = async () => {
            const TrackerConstants = await import('./tracker2')
            TrackerConstants.useState.getState().dispatch.closeTracker(action.payload.guiID)
          }
          Z.ignorePromise(f())
          break
        }
        case RemoteGen.trackerLoad: {
          const f = async () => {
            const TrackerConstants = await import('./tracker2')
            TrackerConstants.useState.getState().dispatch.load(action.payload)
          }
          Z.ignorePromise(f())
          break
        }
        case RemoteGen.link:
          {
            const {link} = action.payload
            const f = async () => {
              const DeepLinkConstants = await import('./deeplinks')
              DeepLinkConstants.useState.getState().dispatch.handleAppLink(link)
            }
            Z.ignorePromise(f())
          }
          break
        case RemoteGen.installerRan:
          get().dispatch.installerRan()
          break
        case RemoteGen.updateNow:
          get().dispatch.updateApp()
          break
        case RemoteGen.powerMonitorEvent:
          get().dispatch.powerMonitorEvent(action.payload.event)
          break
        case RemoteGen.showMain:
          get().dispatch.showMain()
          break
        case RemoteGen.dumpLogs:
          Z.ignorePromise(get().dispatch.dumpLogs(action.payload.reason))
          break
        case RemoteGen.remoteWindowWantsProps:
          get().dispatch.remoteWindowNeedsProps(action.payload.component, action.payload.param)
          break
        case RemoteGen.updateWindowMaxState:
          get().dispatch.setWindowIsMax(action.payload.max)
          break
        case RemoteGen.updateWindowState:
          get().dispatch.updateWindowState(action.payload.windowState)
          break
        case RemoteGen.updateWindowShown:
          get().dispatch.windowShown(action.payload.component)
          break
        case RemoteGen.setSystemDarkMode:
          DarkMode.useDarkModeState.getState().dispatch.setSystemDarkMode(action.payload.dark)
          break
      }
    },
    filePickerError: error => {
      get().dispatch.dynamic.onFilePickerError?.(error)
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
    installerRan: () => {
      set(s => {
        s.installerRanCount++
      })
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
    loadOnStart: phase => {
      set(s => {
        s.loadOnStartPhase = phase
      })
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
                  ProvisionConstants.useState.getState().dispatch.dynamic.setUsername?.(username)
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
    logoutAndTryToLogInAs: username => {
      const f = async () => {
        if (get().loggedIn) {
          await RPCTypes.loginLogoutRpcPromise({force: false, keepSecrets: true}, loginWaitingKey)
        }
        get().dispatch.setDefaultUsername(username)
      }
      Z.ignorePromise(f())
    },
    openUnlockFolders: devices => {
      set(s => {
        s.unlockFoldersDevices = devices.map(({name, type, deviceID}) => ({
          deviceID,
          name,
          type: DeviceTypes.stringToDeviceType(type),
        }))
      })
    },
    osNetworkStatusChanged: (online: boolean, type: Types.ConnectionType, isInit?: boolean) => {
      set(s => {
        s.networkStatus = {
          isInit,
          online,
          type,
        }
      })
    },
    powerMonitorEvent: event => {
      const f = async () => {
        await RPCTypes.appStatePowerMonitorEventRpcPromise({event})
      }
      Z.ignorePromise(f())
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
        dispatch: s.dispatch,
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
          s.revokedTrigger++
        })
      }
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
      // already loaded, so just go now
      if (get().startup.loaded) {
        reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['incomingShareNew']}))
      }
    },
    setBadgeState: b => {
      set(s => {
        s.badgeState = b
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
    setGregorPushState: state => {
      const items = state.items || []
      const goodState = items.reduce<State['gregorPushState']>((arr, {md, item}) => {
        md && item && arr.push({item, md})
        return arr
      }, [])
      if (goodState.length !== items.length) {
        logger.warn('Lost some messages in filtering out nonNull gregor items')
      }
      set(s => {
        s.gregorPushState = goodState
      })
    },
    setGregorReachable: (r: Store['gregorReachable']) => {
      set(s => {
        s.gregorReachable = r
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
    setLoggedIn: (l, causedByStartup) => {
      set(s => {
        s.loggedIn = l
        s.loggedInCausedbyStartup = causedByStartup
      })
    },
    setMobileAppState: nextAppState => {
      set(s => {
        s.mobileAppState = nextAppState
      })
    },
    setNavigatorExists: () => {
      get().dispatch.dynamic.setNavigatorExistsNative?.()
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
    showMain: () => {
      get().dispatch.dynamic.showMainNative?.()
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
    updateGregorCategory: (category, body, dtime) => {
      const f = async () => {
        try {
          await RPCTypes.gregorUpdateCategoryRpcPromise({
            body,
            category,
            dtime: dtime || {offset: 0, time: 0},
          })
        } catch (_) {}
      }
      Z.ignorePromise(f())
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
