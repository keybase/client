import * as C from '.'
import * as T from './types'
import * as EngineGen from '../actions/engine-gen-gen'
import * as RemoteGen from '../actions/remote-gen'
import * as Stats from '../engine/stats'
import * as Z from '@/util/zustand'
import {noConversationIDKey} from './chat2'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import type {Tab} from './tabs'
import uniq from 'lodash/uniq'
import {RPCError, convertToError, isEOFError, isErrorTransient, niceError} from '@/util/errors'
import {defaultUseNativeFrame, runMode, isMobile} from './platform'
import {type CommonResponseHandler} from '../engine/types'
import {useAvatarState} from '@/common-adapters/avatar-zus'
import {mapGetEnsureValue} from '@/util/map'

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

export const privateFolderWithUsers = (users: ReadonlyArray<string>) =>
  `${defaultKBFSPath}${defaultPrivatePrefix}${uniq(users).join(',')}`
export const publicFolderWithUsers = (users: ReadonlyArray<string>) =>
  `${defaultKBFSPath}${defaultPublicPrefix}${uniq(users).join(',')}`
export const teamFolder = (team: string) => `${defaultKBFSPath}${defaultTeamPrefix}${team}`

export type Store = T.Immutable<{
  forceSmallNav: boolean
  allowAnimatedEmojis: boolean
  androidShare?:
    | {type: T.RPCGen.IncomingShareType.file; urls: Array<string>}
    | {type: T.RPCGen.IncomingShareType.text; text: string}
  appFocused: boolean
  badgeState?: T.RPCGen.BadgeState
  configuredAccounts: Array<T.Config.ConfiguredAccount>
  defaultUsername: string
  globalError?: Error | RPCError
  gregorReachable?: T.RPCGen.Reachable
  gregorPushState: Array<{md: T.RPCGregor.Metadata; item: T.RPCGregor.Item}>
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
  networkStatus?: {online: boolean; type: T.Config.ConnectionType; isInit?: boolean}
  notifySound: boolean
  openAtLogin: boolean
  outOfDate: T.Config.OutOfDate
  remoteWindowNeedsProps: Map<string, Map<string, number>>
  revokedTrigger: number
  runtimeStats?: T.RPCGen.RuntimeStats
  startup: {
    loaded: boolean
    conversation: T.Chat.ConversationIDKey
    followUser: string
    link: string
    tab?: Tab
  }
  unlockFoldersDevices: Array<{
    type: T.Devices.DeviceType
    name: string
    deviceID: T.Devices.DeviceID
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
}>

const initialStore: Store = {
  allowAnimatedEmojis: true,
  androidShare: undefined,
  appFocused: true,
  badgeState: undefined,
  configuredAccounts: [],
  defaultUsername: '',
  forceSmallNav: false,
  globalError: undefined,
  gregorPushState: [],
  gregorReachable: undefined,
  httpSrv: {
    address: '',
    token: '',
  },
  incomingShareUseOriginal: undefined,
  installerRanCount: 0,
  isOnline: true,
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

interface State extends Store {
  dispatch: {
    dynamic: {
      copyToClipboard: (s: string) => void
      dumpLogsNative?: (reason: string) => Promise<void>
      onFilePickerError?: (error: Error) => void
      openAppSettings?: () => void
      openAppStore?: () => void
      onEngineConnectedDesktop?: () => void
      onEngineIncomingDesktop?: (action: EngineGen.Actions) => void
      onEngineIncomingNative?: (action: EngineGen.Actions) => void
      persistRoute?: (path?: ReadonlyArray<any>) => void
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
    initForceSmallNav: () => void
    initOpenAtLogin: () => void
    initUseNativeFrame: () => void
    installerRan: () => void
    loadIsOnline: () => void
    loadOnStart: (phase: State['loadOnStartPhase']) => void
    login: (username: string, password: string) => void
    loginError: (error?: RPCError) => void
    logoutAndTryToLogInAs: (username: string) => void
    onEngineConnected: () => void
    onEngineDisonnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    osNetworkStatusChanged: (online: boolean, type: T.Config.ConnectionType, isInit?: boolean) => void
    openUnlockFolders: (devices: ReadonlyArray<T.RPCGen.Device>) => void
    powerMonitorEvent: (event: string) => void
    resetState: (isDebug?: boolean) => void
    remoteWindowNeedsProps: (component: string, params: string) => void
    resetRevokedSelf: () => void
    revoke: (deviceName: string) => void
    setAccounts: (a: Store['configuredAccounts']) => void
    setAndroidShare: (s: Store['androidShare']) => void
    setBadgeState: (b: State['badgeState']) => void
    setDefaultUsername: (u: string) => void
    setForceSmallNav: (f: boolean) => void
    setGlobalError: (e?: unknown) => void
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
    setOutOfDate: (outOfDate: T.Config.OutOfDate) => void
    setUserSwitching: (sw: boolean) => void
    setUseNativeFrame: (use: boolean) => void
    setupSubscriptions: () => void
    showMain: () => void
    toggleRuntimeStats: () => void
    updateGregorCategory: (category: string, body: string, dtime?: {offset: number; time: number}) => void
    updateWindowState: (ws: Omit<Store['windowState'], 'isMaximized'>) => void
  }
}

export const openAtLoginKey = 'openAtLogin'
export const _useConfigState = Z.createZustand<State>((set, get) => {
  const nativeFrameKey = 'useNativeFrame'
  const notifySoundKey = 'notifySound'
  const forceSmallNavKey = 'ui.forceSmallNav'

  const _checkForUpdate = async () => {
    try {
      const {status, message} = await T.RPCGen.configGetUpdateInfoRpcPromise()
      get().dispatch.setOutOfDate(
        status !== T.RPCGen.UpdateInfoStatus.upToDate
          ? {
              critical: status === T.RPCGen.UpdateInfoStatus.criticallyOutOfDate,
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

  const setGregorReachable = (r: Store['gregorReachable']) => {
    const old = get().gregorReachable
    if (old === r) return
    set(s => {
      s.gregorReachable = r
    })
    // Re-get info about our account if you log in/we're done handshaking/became reachable
    if (r === T.RPCGen.Reachable.yes) {
      // not in waiting state
      if (C.useDaemonState.getState().handshakeWaiters.size === 0) {
        C.ignorePromise(C.useDaemonState.getState().dispatch.loadDaemonBootstrapStatus())
      }
    }

    C.useTeamsState.getState().dispatch.eagerLoadTeams()
  }

  const setGregorPushState = (state: T.RPCGen.Gregor1.State) => {
    const items = state.items || []
    const goodState = items.reduce<Array<{md: T.RPCGregor.Metadata; item: T.RPCGregor.Item}>>(
      (arr, {md, item}) => {
        md && item && arr.push({item, md})
        return arr
      },
      []
    )
    if (goodState.length !== items.length) {
      logger.warn('Lost some messages in filtering out nonNull gregor items')
    }
    set(s => {
      s.gregorPushState = T.castDraft(goodState)
    })

    const allowAnimatedEmojis = !goodState.find(i => i.item.category === 'emojianimations')
    set(s => {
      s.allowAnimatedEmojis = allowAnimatedEmojis
    })

    const lastSeenItem = goodState.find(i => i.item.category === 'whatsNewLastSeenVersion')
    C.useWNState.getState().dispatch.updateLastSeen(lastSeenItem)
    C.useTeamsState.getState().dispatch.onGregorPushState(goodState)
    C.useChatState.getState().dispatch.updatedGregor(goodState)
  }

  const updateApp = () => {
    const f = async () => {
      await T.RPCGen.configStartUpdateIfNeededRpcPromise()
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
  }

  const updateRuntimeStats = (stats?: T.RPCGen.RuntimeStats) => {
    set(s => {
      if (!stats) {
        s.runtimeStats = stats
      } else {
        s.runtimeStats = T.castDraft({
          ...s.runtimeStats,
          ...stats,
        })
      }
    })
  }

  const dispatch: State['dispatch'] = {
    changedFocus: f => {
      if (get().appFocused === f) return
      set(s => {
        s.appFocused = f
      })

      if (!isMobile || !f) {
        return
      }
      const {dispatch} = C.getConvoState(C.Chat.getSelectedConversation())
      dispatch.loadMoreMessages({reason: 'foregrounding'})
      dispatch.markThreadAsRead()
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
      onEngineConnectedDesktop: undefined,
      onEngineIncomingDesktop: undefined,
      onEngineIncomingNative: undefined,
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
        case RemoteGen.openChatFromWidget: {
          C.useConfigState.getState().dispatch.showMain()
          C.getConvoState(action.payload.conversationIDKey).dispatch.navigateToThread('inboxSmall')
          break
        }
        case RemoteGen.inboxRefresh: {
          C.useChatState.getState().dispatch.inboxRefresh('widgetRefresh')
          break
        }
        case RemoteGen.engineConnection: {
          if (action.payload.connected) {
            C.useEngineState.getState().dispatch.onEngineConnected()
          } else {
            C.useEngineState.getState().dispatch.onEngineDisconnected()
          }
          break
        }
        case RemoteGen.switchTab: {
          C.useRouterState.getState().dispatch.switchTab(action.payload.tab)
          break
        }
        case RemoteGen.setCriticalUpdate: {
          C.useFSState.getState().dispatch.setCriticalUpdate(action.payload.critical)
          break
        }
        case RemoteGen.userFileEditsLoad: {
          C.useFSState.getState().dispatch.userFileEditsLoad()
          break
        }
        case RemoteGen.openFilesFromWidget: {
          C.useFSState.getState().dispatch.dynamic.openFilesFromWidgetDesktop?.(action.payload.path)
          break
        }
        case RemoteGen.saltpackFileOpen: {
          C.useDeepLinksState.getState().dispatch.handleSaltPackOpen(action.payload.path)
          break
        }
        case RemoteGen.pinentryOnCancel: {
          C.usePinentryState.getState().dispatch.dynamic.onCancel?.()
          break
        }
        case RemoteGen.pinentryOnSubmit: {
          C.usePinentryState.getState().dispatch.dynamic.onSubmit?.(action.payload.password)
          break
        }
        case RemoteGen.openPathInSystemFileManager: {
          C.useFSState.getState().dispatch.dynamic.openPathInSystemFileManagerDesktop?.(action.payload.path)
          break
        }
        case RemoteGen.unlockFoldersSubmitPaperKey: {
          T.RPCGen.loginPaperKeySubmitRpcPromise(
            {paperPhrase: action.payload.paperKey},
            'unlock-folders:waiting'
          )
            .then(() => {
              get().dispatch.openUnlockFolders([])
            })
            .catch((e: unknown) => {
              if (!(e instanceof C.RPCError)) return
              set(s => {
                s.unlockFoldersError = e.desc
              })
            })
          break
        }
        case RemoteGen.closeUnlockFolders: {
          T.RPCGen.rekeyRekeyStatusFinishRpcPromise()
            .then(() => {})
            .catch(() => {})
          get().dispatch.openUnlockFolders([])
          break
        }
        case RemoteGen.stop: {
          C.useSettingsState.getState().dispatch.stop(action.payload.exitCode)
          break
        }
        case RemoteGen.trackerChangeFollow: {
          C.useTrackerState.getState().dispatch.changeFollow(action.payload.guiID, action.payload.follow)
          break
        }
        case RemoteGen.trackerIgnore: {
          C.useTrackerState.getState().dispatch.ignore(action.payload.guiID)
          break
        }
        case RemoteGen.trackerCloseTracker: {
          C.useTrackerState.getState().dispatch.closeTracker(action.payload.guiID)
          break
        }
        case RemoteGen.trackerLoad: {
          C.useTrackerState.getState().dispatch.load(action.payload)
          break
        }
        case RemoteGen.link:
          {
            const {link} = action.payload
            C.useDeepLinksState.getState().dispatch.handleAppLink(link)
          }
          break
        case RemoteGen.installerRan:
          get().dispatch.installerRan()
          break
        case RemoteGen.updateNow:
          updateApp()
          break
        case RemoteGen.powerMonitorEvent:
          get().dispatch.powerMonitorEvent(action.payload.event)
          break
        case RemoteGen.showMain:
          get().dispatch.showMain()
          break
        case RemoteGen.dumpLogs:
          C.ignorePromise(get().dispatch.dumpLogs(action.payload.reason))
          break
        case RemoteGen.remoteWindowWantsProps:
          get().dispatch.remoteWindowNeedsProps(action.payload.component, action.payload.param)
          break
        case RemoteGen.updateWindowMaxState:
          set(s => {
            s.windowState.isMaximized = action.payload.max
          })
          break
        case RemoteGen.updateWindowState:
          get().dispatch.updateWindowState(action.payload.windowState)
          break
        case RemoteGen.updateWindowShown: {
          const win = action.payload.component
          set(s => {
            s.windowShownCount.set(win, (s.windowShownCount.get(win) ?? 0) + 1)
          })
          break
        }
        case RemoteGen.setSystemDarkMode:
          C.useDarkModeState.getState().dispatch.setSystemDarkMode(action.payload.dark)
          break
        case RemoteGen.previewConversation:
          C.useChatState
            .getState()
            .dispatch.previewConversation({participants: [action.payload.participant], reason: 'tracker'})
          break
      }
    },
    filePickerError: error => {
      get().dispatch.dynamic.onFilePickerError?.(error)
    },
    initAppUpdateLoop: () => {
      const f = async () => {
        while (true) {
          try {
            await _checkForUpdate()
          } catch {}
          await timeoutPromise(3_600_000) // 1 hr
        }
      }
      ignorePromise(f())
    },
    initForceSmallNav: () => {
      const f = async () => {
        try {
          const val = await T.RPCGen.configGuiGetValueRpcPromise({path: forceSmallNavKey})
          const forceSmallNav = val.b
          if (typeof forceSmallNav === 'boolean') {
            set(s => {
              s.forceSmallNav = forceSmallNav
            })
          }
        } catch {}
      }
      ignorePromise(f())
    },
    initNotifySound: () => {
      const f = async () => {
        try {
          const val = await T.RPCGen.configGuiGetValueRpcPromise({path: notifySoundKey})
          const notifySound = val.b
          if (typeof notifySound === 'boolean') {
            set(s => {
              s.notifySound = notifySound
            })
          }
        } catch {}
      }
      ignorePromise(f())
    },
    initOpenAtLogin: () => {
      const f = async () => {
        try {
          const val = await T.RPCGen.configGuiGetValueRpcPromise({path: openAtLoginKey})
          const openAtLogin = val.b
          if (typeof openAtLogin === 'boolean') {
            get().dispatch.setOpenAtLogin(openAtLogin)
          }
        } catch {}
      }
      ignorePromise(f())
    },
    initUseNativeFrame: () => {
      const f = async () => {
        try {
          const val = await T.RPCGen.configGuiGetValueRpcPromise({path: nativeFrameKey})
          const useNativeFrame = val.b === undefined || val.b === null ? defaultUseNativeFrame : val.b
          set(s => {
            s.useNativeFrame = useNativeFrame
          })
        } catch {}
      }
      ignorePromise(f())
    },
    installerRan: () => {
      set(s => {
        s.installerRanCount++
      })

      C.useFSState.getState().dispatch.checkKbfsDaemonRpcStatus()
    },
    loadIsOnline: () => {
      const f = async () => {
        try {
          const isOnline = await T.RPCGen.loginIsOnlineRpcPromise(undefined)
          set(s => {
            s.isOnline = isOnline
          })
        } catch (err) {
          logger.warn('Error in checking whether we are online', err)
        }
      }
      C.ignorePromise(f())
    },
    loadOnStart: phase => {
      if (phase === get().loadOnStartPhase) return
      set(s => {
        s.loadOnStartPhase = phase
      })

      if (phase === 'startupOrReloginButNotInARush') {
        const getFollowerInfo = () => {
          const {uid} = C.useCurrentUserState.getState()
          logger.info(`getFollowerInfo: init; uid=${uid}`)
          if (uid) {
            // request follower info in the background
            T.RPCGen.configRequestFollowingAndUnverifiedFollowersRpcPromise()
              .then(() => {})
              .catch(() => {})
          }
        }

        const updateServerConfig = async () => {
          if (get().loggedIn) {
            await T.RPCGen.configUpdateLastLoggedInAndServerConfigRpcPromise({
              serverConfigPath: C.serverConfigFileName,
            })
          }
        }

        const updateTeams = () => {
          C.useTeamsState.getState().dispatch.getTeams()
          C.useTeamsState.getState().dispatch.refreshTeamRoleMap()
        }

        const updateSettings = () => {
          C.useSettingsContactsState.getState().dispatch.loadContactImportEnabled()
        }

        const updateChat = async () => {
          // On login lets load the untrusted inbox. This helps make some flows easier
          if (C.useCurrentUserState.getState().username) {
            const {inboxRefresh} = C.useChatState.getState().dispatch
            inboxRefresh('bootstrap')
          }
          try {
            const rows = await T.RPCGen.configGuiGetValueRpcPromise({path: 'ui.inboxSmallRows'})
            const ri = rows.i ?? -1
            if (ri > 0) {
              C.useChatState.getState().dispatch.setInboxNumSmallRows(ri, true)
            }
          } catch {}
        }

        getFollowerInfo()
        C.ignorePromise(updateServerConfig())
        updateTeams()
        updateSettings()
        C.ignorePromise(updateChat())
      }
    },
    login: (username, passphrase) => {
      const cancelDesc = 'Canceling RPC'
      const cancelOnCallback = (_: unknown, response: CommonResponseHandler) => {
        response.error({code: T.RPCGen.StatusCode.scgeneric, desc: cancelDesc})
      }
      const ignoreCallback = () => {}
      const f = async () => {
        try {
          await T.RPCGen.loginLoginRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.gpgUi.selectKey': cancelOnCallback,
              'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
              'keybase.1.provisionUi.DisplayAndPromptSecret': cancelOnCallback,
              'keybase.1.provisionUi.PromptNewDeviceName': (_, response) => {
                cancelOnCallback(undefined, response)
                C.useProvisionState.getState().dispatch.dynamic.setUsername?.(username)
              },
              'keybase.1.provisionUi.chooseDevice': cancelOnCallback,
              'keybase.1.provisionUi.chooseGPGMethod': cancelOnCallback,
              'keybase.1.secretUi.getPassphrase': (params, response) => {
                if (params.pinentry.type === T.RPCGen.PassphraseType.passPhrase) {
                  // Service asking us again due to a bad passphrase?
                  if (params.pinentry.retryLabel) {
                    cancelOnCallback(params, response)
                    let retryLabel = params.pinentry.retryLabel
                    if (retryLabel === invalidPasswordErrorString) {
                      retryLabel = 'Incorrect password.'
                    }
                    const error = new RPCError(retryLabel, T.RPCGen.StatusCode.scinputerror)
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
              clientType: T.RPCGen.ClientType.guiMain,
              deviceName: '',
              deviceType: isMobile ? 'mobile' : 'desktop',
              doUserSwitch: true,
              paperKey: '',
              username,
            },
            waitingKey: loginWaitingKey,
          })
          logger.info('login call succeeded')
          get().dispatch.setLoggedIn(true, false)
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          if (error.code === T.RPCGen.StatusCode.scalreadyloggedin) {
            get().dispatch.setLoggedIn(true, false)
          } else if (error.desc !== cancelDesc) {
            // If we're canceling then ignore the error
            error.desc = niceError(error)
            get().dispatch.loginError(error)
          }
        }
      }
      get().dispatch.loginError()
      C.ignorePromise(f())
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
          await T.RPCGen.loginLogoutRpcPromise({force: false, keepSecrets: true}, loginWaitingKey)
        }
        get().dispatch.setDefaultUsername(username)
      }
      C.ignorePromise(f())
    },
    onEngineConnected: () => {
      C.useDaemonState.getState().dispatch.startHandshake()

      // The startReachability RPC call both starts and returns the current
      // reachability state. Then we'll get updates of changes from this state via reachabilityChanged.
      // This should be run on app start and service re-connect in case the service somehow crashed or was restarted manually.
      const startReachability = async () => {
        try {
          const reachability = await T.RPCGen.reachabilityStartReachabilityRpcPromise()
          setGregorReachable(reachability.reachable)
        } catch (err) {
          logger.warn('error bootstrapping reachability: ', err)
        }
      }
      C.ignorePromise(startReachability())

      // If ever you want to get OOBMs for a different system, then you need to enter it here.
      const registerForGregorNotifications = async () => {
        try {
          await T.RPCGen.delegateUiCtlRegisterGregorFirehoseFilteredRpcPromise({systems: []})
          logger.info('Registered gregor listener')
        } catch (error) {
          logger.warn('error in registering gregor listener: ', error)
        }
      }
      C.ignorePromise(registerForGregorNotifications())

      get().dispatch.dynamic.onEngineConnectedDesktop?.()
      C.useConfigState.getState().dispatch.loadOnStart('initialStartupAsEarlyAsPossible')
    },
    onEngineDisonnected: () => {
      const f = async () => {
        await logger.dump()
      }
      C.ignorePromise(f())
      C.useDaemonState.getState().dispatch.setError(new Error('Disconnected'))
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.keybase1GregorUIPushState: {
          const {state} = action.payload.params
          setGregorPushState(state)
          break
        }
        case EngineGen.keybase1NotifyRuntimeStatsRuntimeStatsUpdate: {
          updateRuntimeStats(action.payload.params.stats ?? undefined)
          break
        }
        case EngineGen.keybase1NotifyServiceHTTPSrvInfoUpdate: {
          get().dispatch.setHTTPSrvInfo(action.payload.params.info.address, action.payload.params.info.token)
          break
        }
        case EngineGen.keybase1NotifySessionLoggedIn: {
          logger.info('keybase.1.NotifySession.loggedIn')
          // only send this if we think we're not logged in
          const {loggedIn, dispatch} = get()
          if (!loggedIn) {
            dispatch.setLoggedIn(true, false)
          }
          break
        }
        case EngineGen.keybase1NotifySessionLoggedOut: {
          logger.info('keybase.1.NotifySession.loggedOut')
          const {loggedIn, dispatch} = get()
          // only send this if we think we're logged in (errors on provison can trigger this and mess things up)
          if (loggedIn) {
            dispatch.setLoggedIn(false, false)
          }
          break
        }
        case EngineGen.keybase1NotifyTeamAvatarUpdated: {
          const {name} = action.payload.params
          useAvatarState.getState().dispatch.updated(name)
          break
        }
        case EngineGen.keybase1NotifyTrackingTrackingChanged: {
          const {isTracking, username} = action.payload.params
          C.useFollowerState.getState().dispatch.updateFollowing(username, isTracking)
          break
        }
        case EngineGen.keybase1NotifyTrackingTrackingInfo: {
          const {uid, followers: _newFollowers, followees: _newFollowing} = action.payload.params
          if (C.useCurrentUserState.getState().uid !== uid) {
            return
          }
          const newFollowers = new Set(_newFollowers)
          const newFollowing = new Set(_newFollowing)
          const {following: oldFollowing, followers: oldFollowers, dispatch} = C.useFollowerState.getState()
          const following = isEqual(newFollowing, oldFollowing) ? oldFollowing : newFollowing
          const followers = isEqual(newFollowers, oldFollowers) ? oldFollowers : newFollowers
          dispatch.replace(followers, following)
          break
        }

        case EngineGen.keybase1ReachabilityReachabilityChanged:
          if (get().loggedIn) {
            setGregorReachable(action.payload.params.reachability.reachable)
          }
          break
        default:
      }
    },
    openUnlockFolders: devices => {
      set(s => {
        s.unlockFoldersDevices = devices.map(({name, type, deviceID}) => ({
          deviceID,
          name,
          type: T.Devices.stringToDeviceType(type),
        }))
      })
    },
    osNetworkStatusChanged: (online: boolean, type: T.Config.ConnectionType, isInit?: boolean) => {
      const old = get().networkStatus
      set(s => {
        if (!s.networkStatus) {
          s.networkStatus = {isInit, online, type}
        } else {
          s.networkStatus.isInit = isInit
          s.networkStatus.online = online
          s.networkStatus.type = type
        }
      })
      const next = get().networkStatus
      if (next === old) return
      const updateGregor = async () => {
        const reachability = await T.RPCGen.reachabilityCheckReachabilityRpcPromise()
        setGregorReachable(reachability.reachable)
      }
      C.ignorePromise(updateGregor())

      const updateFS = async () => {
        if (isInit) return
        try {
          await T.RPCGen.SimpleFSSimpleFSCheckReachabilityRpcPromise()
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn(`failed to check KBFS reachability: ${error.message}`)
        }
      }
      C.ignorePromise(updateFS())
    },
    powerMonitorEvent: event => {
      const f = async () => {
        await T.RPCGen.appStatePowerMonitorEventRpcPromise({event})
      }
      C.ignorePromise(f())
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
    resetState: isDebug => {
      if (isDebug) return
      set(s => ({
        ...s,
        ...initialStore,
        appFocused: s.appFocused,
        configuredAccounts: s.configuredAccounts,
        defaultUsername: s.defaultUsername,
        dispatch: s.dispatch,
        forceSmallNav: s.forceSmallNav,
        mobileAppState: s.mobileAppState,
        startup: {loaded: s.startup.loaded},
        useNativeFrame: s.useNativeFrame,
        userSwitching: s.userSwitching,
      }))
    },
    revoke: name => {
      const wasCurrentDevice = C.useCurrentUserState.getState().deviceName === name
      if (wasCurrentDevice) {
        const {configuredAccounts, defaultUsername} = get()
        const acc = configuredAccounts.find(n => n.username !== defaultUsername)
        const du = acc?.username ?? ''
        set(s => {
          s.defaultUsername = du
          s.justRevokedSelf = name
          s.revokedTrigger++
        })
        C.useDaemonState.getState().dispatch.loadDaemonAccounts()
      }
    },
    setAccounts: a => {
      set(s => {
        if (!isEqual(a, s.configuredAccounts)) {
          s.configuredAccounts = T.castDraft(a)
        }
      })
    },
    setAndroidShare: share => {
      set(s => {
        s.androidShare = T.castDraft(share)
      })
      // already loaded, so just go now
      if (get().startup.loaded) {
        // android needs the nav to render first sadly
        setTimeout(() => {
          C.useRouterState.getState().dispatch.navigateAppend('incomingShareNew')
        }, 500)
      }
    },
    setBadgeState: b => {
      if (get().badgeState === b) return
      set(s => {
        s.badgeState = T.castDraft(b)
      })

      const updateDevices = () => {
        if (!b) return
        const {setBadges} = C.useDevicesState.getState().dispatch
        const {newDevices, revokedDevices} = b
        setBadges(new Set([...(newDevices ?? []), ...(revokedDevices ?? [])]))
      }
      updateDevices()

      const updateAutoReset = () => {
        if (!b) return
        const {resetState} = b
        C.useAutoResetState.getState().dispatch.updateARState(resetState.active, resetState.endTime)
      }
      updateAutoReset()

      const updateGit = () => {
        const {setBadges} = C.useGitState.getState().dispatch
        setBadges(new Set(b?.newGitRepoGlobalUniqueIDs))
      }
      updateGit()

      const updateTeams = () => {
        const loggedIn = get().loggedIn
        if (!loggedIn) {
          // Don't make any calls we don't have permission to.
          return
        }
        if (!b) return
        const deletedTeams = b.deletedTeams || []
        const newTeams = new Set<string>(b.newTeams || [])
        const teamsWithResetUsers: ReadonlyArray<T.RPCGen.TeamMemberOutReset> = b.teamsWithResetUsers || []
        const teamsWithResetUsersMap = new Map<T.Teams.TeamID, Set<string>>()
        teamsWithResetUsers.forEach(entry => {
          const existing = mapGetEnsureValue(teamsWithResetUsersMap, entry.teamID, new Set())
          existing.add(entry.username)
        })
        // if the user wasn't on the teams tab, loads will be triggered by navigation around the app
        C.useTeamsState.getState().dispatch.setNewTeamInfo(deletedTeams, newTeams, teamsWithResetUsersMap)
      }
      updateTeams()

      const updateChat = () => {
        if (!b) return
        b.conversations?.forEach(c => {
          const id = T.Chat.conversationIDToKey(c.convID)
          C.getConvoState(id).dispatch.badgesUpdated(c.badgeCount)
          C.getConvoState(id).dispatch.unreadUpdated(c.unreadMessages)
        })
        C.useChatState.getState().dispatch.badgesUpdated(b.bigTeamBadgeCount, b.smallTeamBadgeCount)
      }
      updateChat()
    },
    setDefaultUsername: u => {
      set(s => {
        s.defaultUsername = u
      })
    },
    setForceSmallNav: force => {
      const f = async () => {
        await T.RPCGen.configGuiSetValueRpcPromise({
          path: forceSmallNavKey,
          value: {
            b: force,
            isNull: false,
          },
        })
        set(s => {
          s.forceSmallNav = force
        })
      }
      ignorePromise(f())
    },
    setGlobalError: _e => {
      if (_e) {
        const e = convertToError(_e)
        set(s => {
          s.globalError = e
        })
        logger.error('Error (global):', e.message, e)
        if (isEOFError(e)) {
          Stats.gotEOF()
        }
        if (isErrorTransient(e)) {
          logger.info('globalError silencing:', e)
          return
        }
      } else {
        set(s => {
          s.globalError = undefined
        })
      }
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
    setLoggedIn: (loggedIn, causedByStartup) => {
      const changed = get().loggedIn !== loggedIn
      set(s => {
        s.loggedIn = loggedIn
        s.loggedInCausedbyStartup = causedByStartup
      })

      if (!changed) return

      if (loggedIn) {
        C.ignorePromise(C.useDaemonState.getState().dispatch.loadDaemonBootstrapStatus())
      }
      C.useDaemonState.getState().dispatch.loadDaemonAccounts()

      const {loadOnStart} = get().dispatch
      if (loggedIn) {
        if (!causedByStartup) {
          loadOnStart('reloggedIn')
          const f = async () => {
            await C.timeoutPromise(1000)
            requestAnimationFrame(() => {
              loadOnStart('startupOrReloginButNotInARush')
            })
          }
          C.ignorePromise(f())
        }
      } else {
        Z.resetAllStores()
      }

      if (loggedIn) {
        C.useFSState.getState().dispatch.checkKbfsDaemonRpcStatus()
      }

      if (!causedByStartup) {
        C.ignorePromise(C.useDaemonState.getState().dispatch.refreshAccounts())
      }
    },
    setMobileAppState: nextAppState => {
      if (get().mobileAppState === nextAppState) return
      set(s => {
        s.mobileAppState = nextAppState
      })
      if (nextAppState === 'background' && C.useChatState.getState().inboxSearch) {
        C.useChatState.getState().dispatch.toggleInboxSearch(false)
      }
    },
    setNavigatorExists: () => {
      get().dispatch.dynamic.setNavigatorExistsNative?.()
    },
    setNotifySound: n => {
      set(s => {
        s.notifySound = n
      })
      ignorePromise(
        T.RPCGen.configGuiSetValueRpcPromise({
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
        s.outOfDate.critical = outOfDate.critical
        s.outOfDate.message = outOfDate.message
        s.outOfDate.updating = outOfDate.updating
        s.outOfDate.outOfDate = outOfDate.outOfDate
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
        T.RPCGen.configGuiSetValueRpcPromise({
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
    setupSubscriptions: () => {
      // Kick off platform specific stuff
      C.PlatformSpecific.initPlatformListener()
    },
    showMain: () => {
      get().dispatch.dynamic.showMainNative?.()
    },
    toggleRuntimeStats: () => {
      const f = async () => {
        await T.RPCGen.configToggleRuntimeStatsRpcPromise()
      }
      ignorePromise(f())
    },
    updateGregorCategory: (category, body, dtime) => {
      const f = async () => {
        try {
          await T.RPCGen.gregorUpdateCategoryRpcPromise({
            body,
            category,
            dtime: dtime || {offset: 0, time: 0},
          })
        } catch {}
      }
      C.ignorePromise(f())
    },
    updateWindowState: ws => {
      const next = {...get().windowState, ...ws}
      set(s => {
        s.windowState = next
      })

      const windowStateKey = 'windowState'
      ignorePromise(
        T.RPCGen.configGuiSetValueRpcPromise({
          path: windowStateKey,
          value: {
            isNull: false,
            s: JSON.stringify(next),
          },
        })
      )
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
