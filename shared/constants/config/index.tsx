import * as T from '../types'
import {ignorePromise, timeoutPromise} from '../utils'
import {serverConfigFileName} from '../platform'
import {waitingKeyConfigLogin} from '../strings'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as RemoteGen from '@/actions/remote-gen'
import * as Stats from '@/engine/stats'
import * as Z from '@/util/zustand'
import {noConversationIDKey} from '../types/chat2/common'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import type {Tab} from '../tabs'
import {RPCError, convertToError, isEOFError, isErrorTransient, niceError} from '@/util/errors'
import {defaultUseNativeFrame, isMobile} from '../platform'
import {type CommonResponseHandler} from '@/engine/types'
import {invalidPasswordErrorString} from './util'
import {switchTab} from '../router2/util'
import {storeRegistry} from '../store-registry'
import {getSelectedConversation} from '@/constants/chat2/common'

type Store = T.Immutable<{
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

export interface State extends Store {
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
      persistRoute?: (clear: boolean, immediate: boolean) => void
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
    setLoginError: (error?: RPCError) => void
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
    setLoggedIn: (l: boolean, causedByStartup: boolean, fromMenubar?: boolean) => void
    setMobileAppState: (nextAppState: 'active' | 'background' | 'inactive') => void
    setNotifySound: (n: boolean) => void
    setStartupDetails: (st: Omit<Store['startup'], 'loaded'>) => void
    setOpenAtLogin: (open: boolean) => void
    setOutOfDate: (outOfDate: T.Config.OutOfDate) => void
    setUserSwitching: (sw: boolean) => void
    setUseNativeFrame: (use: boolean) => void
    showMain: () => void
    toggleRuntimeStats: () => void
    updateGregorCategory: (category: string, body: string, dtime?: {offset: number; time: number}) => void
    updateWindowState: (ws: Omit<Store['windowState'], 'isMaximized'>) => void
  }
}

export const openAtLoginKey = 'openAtLogin'
export const useConfigState = Z.createZustand<State>((set, get) => {
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
      if (storeRegistry.getState('daemon').handshakeWaiters.size === 0) {
        ignorePromise(storeRegistry.getState('daemon').dispatch.loadDaemonBootstrapStatus())
      }
    }

    storeRegistry.getState('teams').dispatch.eagerLoadTeams()
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
    storeRegistry.getState('whats-new').dispatch.updateLastSeen(lastSeenItem)
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
      const {dispatch} = storeRegistry.getConvoState(getSelectedConversation())
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
          get().dispatch.showMain()
          storeRegistry
            .getConvoState(action.payload.conversationIDKey)
            .dispatch.navigateToThread('inboxSmall')
          break
        }
        case RemoteGen.inboxRefresh: {
          storeRegistry.getState('chat').dispatch.inboxRefresh('widgetRefresh')
          break
        }
        case RemoteGen.engineConnection: {
          if (action.payload.connected) {
            storeRegistry.getState('engine').dispatch.onEngineConnected()
          } else {
            storeRegistry.getState('engine').dispatch.onEngineDisconnected()
          }
          break
        }
        case RemoteGen.switchTab: {
          switchTab(action.payload.tab)
          break
        }
        case RemoteGen.setCriticalUpdate: {
          storeRegistry.getState('fs').dispatch.setCriticalUpdate(action.payload.critical)
          break
        }
        case RemoteGen.userFileEditsLoad: {
          storeRegistry.getState('fs').dispatch.userFileEditsLoad()
          break
        }
        case RemoteGen.openFilesFromWidget: {
          storeRegistry.getState('fs').dispatch.dynamic.openFilesFromWidgetDesktop?.(action.payload.path)
          break
        }
        case RemoteGen.saltpackFileOpen: {
          storeRegistry.getState('deeplinks').dispatch.handleSaltPackOpen(action.payload.path)
          break
        }
        case RemoteGen.pinentryOnCancel: {
          storeRegistry.getState('pinentry').dispatch.dynamic.onCancel?.()
          break
        }
        case RemoteGen.pinentryOnSubmit: {
          storeRegistry.getState('pinentry').dispatch.dynamic.onSubmit?.(action.payload.password)
          break
        }
        case RemoteGen.openPathInSystemFileManager: {
          storeRegistry
            .getState('fs')
            .dispatch.dynamic.openPathInSystemFileManagerDesktop?.(action.payload.path)
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
              if (!(e instanceof RPCError)) return
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
          storeRegistry.getState('settings').dispatch.stop(action.payload.exitCode)
          break
        }
        case RemoteGen.trackerChangeFollow: {
          storeRegistry
            .getState('tracker2')
            .dispatch.changeFollow(action.payload.guiID, action.payload.follow)
          break
        }
        case RemoteGen.trackerIgnore: {
          storeRegistry.getState('tracker2').dispatch.ignore(action.payload.guiID)
          break
        }
        case RemoteGen.trackerCloseTracker: {
          storeRegistry.getState('tracker2').dispatch.closeTracker(action.payload.guiID)
          break
        }
        case RemoteGen.trackerLoad: {
          storeRegistry.getState('tracker2').dispatch.load(action.payload)
          break
        }
        case RemoteGen.link:
          {
            const {link} = action.payload
            storeRegistry.getState('deeplinks').dispatch.handleAppLink(link)
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
          ignorePromise(get().dispatch.dumpLogs(action.payload.reason))
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
        case RemoteGen.previewConversation:
          storeRegistry
            .getState('chat')
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

      storeRegistry.getState('fs').dispatch.checkKbfsDaemonRpcStatus()
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
      ignorePromise(f())
    },
    loadOnStart: phase => {
      if (phase === get().loadOnStartPhase) return
      set(s => {
        s.loadOnStartPhase = phase
      })

      if (phase === 'startupOrReloginButNotInARush') {
        const getFollowerInfo = () => {
          const {uid} = storeRegistry.getState('current-user')
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
            try {
              await T.RPCGen.configUpdateLastLoggedInAndServerConfigRpcPromise({
                serverConfigPath: serverConfigFileName,
              })
            } catch {}
          }
        }

        const updateTeams = () => {
          storeRegistry.getState('teams').dispatch.getTeams()
          storeRegistry.getState('teams').dispatch.refreshTeamRoleMap()
        }

        const updateSettings = () => {
          storeRegistry.getState('settings-contacts').dispatch.loadContactImportEnabled()
        }

        const updateChat = async () => {
          // On login lets load the untrusted inbox. This helps make some flows easier
          if (storeRegistry.getState('current-user').username) {
            const {inboxRefresh} = storeRegistry.getState('chat').dispatch
            inboxRefresh('bootstrap')
          }
          try {
            const rows = await T.RPCGen.configGuiGetValueRpcPromise({path: 'ui.inboxSmallRows'})
            const ri = rows.i ?? -1
            if (ri > 0) {
              storeRegistry.getState('chat').dispatch.setInboxNumSmallRows(ri, true)
            }
          } catch {}
        }

        getFollowerInfo()
        ignorePromise(updateServerConfig())
        updateTeams()
        updateSettings()
        ignorePromise(updateChat())
      }
    },
    login: (username, passphrase) => {
      const cancelDesc = 'Canceling RPC'
      const cancelOnCallback = (_: any, response: CommonResponseHandler) => {
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
                storeRegistry.getState('provision').dispatch.dynamic.setUsername?.(username)
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
                    get().dispatch.setLoginError(error)
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
            waitingKey: waitingKeyConfigLogin,
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
            get().dispatch.setLoginError(error)
          }
        }
      }
      get().dispatch.setLoginError()
      ignorePromise(f())
    },
    logoutAndTryToLogInAs: username => {
      const f = async () => {
        if (get().loggedIn) {
          await T.RPCGen.loginLogoutRpcPromise({force: false, keepSecrets: true}, waitingKeyConfigLogin)
        }
        get().dispatch.setDefaultUsername(username)
      }
      ignorePromise(f())
    },
    onEngineConnected: () => {
      storeRegistry.getState('daemon').dispatch.startHandshake()

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
      ignorePromise(startReachability())

      // If ever you want to get OOBMs for a different system, then you need to enter it here.
      const registerForGregorNotifications = async () => {
        try {
          await T.RPCGen.delegateUiCtlRegisterGregorFirehoseFilteredRpcPromise({systems: []})
          logger.info('Registered gregor listener')
        } catch (error) {
          logger.warn('error in registering gregor listener: ', error)
        }
      }
      ignorePromise(registerForGregorNotifications())

      get().dispatch.dynamic.onEngineConnectedDesktop?.()
      get().dispatch.loadOnStart('initialStartupAsEarlyAsPossible')
    },
    onEngineDisonnected: () => {
      const f = async () => {
        await logger.dump()
      }
      ignorePromise(f())
      storeRegistry.getState('daemon').dispatch.setError(new Error('Disconnected'))
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
          storeRegistry.getState('avatar').dispatch.updated(name)
          break
        }
        case EngineGen.keybase1NotifyTrackingTrackingChanged: {
          const {isTracking, username} = action.payload.params
          storeRegistry.getState('followers').dispatch.updateFollowing(username, isTracking)
          break
        }
        case EngineGen.keybase1NotifyTrackingTrackingInfo: {
          const {uid, followers: _newFollowers, followees: _newFollowing} = action.payload.params
          if (storeRegistry.getState('current-user').uid !== uid) {
            return
          }
          const newFollowers = new Set(_newFollowers)
          const newFollowing = new Set(_newFollowing)
          const {
            following: oldFollowing,
            followers: oldFollowers,
            dispatch,
          } = storeRegistry.getState('followers')
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
      ignorePromise(updateGregor())

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
      ignorePromise(updateFS())
    },
    powerMonitorEvent: event => {
      const f = async () => {
        await T.RPCGen.appStatePowerMonitorEventRpcPromise({event})
      }
      ignorePromise(f())
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
      const wasCurrentDevice = storeRegistry.getState('current-user').deviceName === name
      if (wasCurrentDevice) {
        const {configuredAccounts, defaultUsername} = get()
        const acc = configuredAccounts.find(n => n.username !== defaultUsername)
        const du = acc?.username ?? ''
        set(s => {
          s.defaultUsername = du
          s.justRevokedSelf = name
          s.revokedTrigger++
        })
        storeRegistry.getState('daemon').dispatch.loadDaemonAccounts()
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
    },
    setBadgeState: b => {
      if (get().badgeState === b) return
      set(s => {
        s.badgeState = T.castDraft(b)
      })
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
    setLoggedIn: (loggedIn, causedByStartup, fromMenubar = false) => {
      const changed = get().loggedIn !== loggedIn
      set(s => {
        s.loggedIn = loggedIn
        s.loggedInCausedbyStartup = causedByStartup
      })

      if (fromMenubar) return

      if (!changed) return

      if (loggedIn) {
        ignorePromise(storeRegistry.getState('daemon').dispatch.loadDaemonBootstrapStatus())
      }
      storeRegistry.getState('daemon').dispatch.loadDaemonAccounts()

      const {loadOnStart} = get().dispatch
      if (loggedIn) {
        if (!causedByStartup) {
          loadOnStart('reloggedIn')
          const f = async () => {
            await timeoutPromise(1000)
            requestAnimationFrame(() => {
              loadOnStart('startupOrReloginButNotInARush')
            })
          }
          ignorePromise(f())
        }
      } else {
        Z.resetAllStores()
      }

      if (loggedIn) {
        storeRegistry.getState('fs').dispatch.checkKbfsDaemonRpcStatus()
      }

      if (!causedByStartup) {
        ignorePromise(storeRegistry.getState('daemon').dispatch.refreshAccounts())
      }
    },
    setLoginError: error => {
      set(s => {
        s.loginError = error
      })
      // On login error, turn off the user switching flag, so that the login screen is not
      // hidden and the user can see and respond to the error.
      get().dispatch.setUserSwitching(false)
    },
    setMobileAppState: nextAppState => {
      if (get().mobileAppState === nextAppState) return
      set(s => {
        s.mobileAppState = nextAppState
      })
      if (nextAppState === 'background' && storeRegistry.getState('chat').inboxSearch) {
        storeRegistry.getState('chat').dispatch.toggleInboxSearch(false)
      }
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
      ignorePromise(f())
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
