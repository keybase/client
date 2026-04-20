import * as T from '@/constants/types'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import {waitingKeyConfigLogin, waitingKeyConfigLoginAsOther} from '@/constants/strings'
import type * as EngineGen from '@/constants/rpc'
import * as Z from '@/util/zustand'
import {noConversationIDKey} from '@/constants/types/chat/common'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import type {Tab} from '@/constants/tabs'
import {RPCError, convertToError, isErrorTransient, niceError} from '@/util/errors'
import {isMobile} from '@/constants/platform'
import {type CommonResponseHandler} from '@/engine/types'
import {invalidPasswordErrorString} from '@/constants/config'
import {navigateAppend} from '@/constants/router'
import {
  onEngineConnected as onEngineConnectedInPlatform,
} from '@/util/storeless-actions'

type Store = T.Immutable<{
  allowAnimatedEmojis: boolean
  androidShare?:
    | {type: T.RPCGen.IncomingShareType.file; urls: Array<string>}
    | {type: T.RPCGen.IncomingShareType.text; text: string}
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
  userSwitching: boolean
  windowShownCount: Map<string, number>
}>

const initialStore: Store = {
  allowAnimatedEmojis: true,
  androidShare: undefined,
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
  isOnline: true,
  justDeletedSelf: '',
  justRevokedSelf: '',
  loadOnStartPhase: 'notStarted',
  loggedIn: false,
  loggedInCausedbyStartup: false,
  loginError: undefined,
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
  userSwitching: false,
  windowShownCount: new Map(),
}

export type State = Store & {
  dispatch: {
    checkForUpdate: () => void
    initAppUpdateLoop: () => void
    installerRan: () => void
    loadIsOnline: () => void
    loadOnStart: (phase: State['loadOnStartPhase']) => void
    login: (username: string, password: string) => void
    setLoginError: (error?: RPCError) => void
    logoutToLoggedOutFlow: () => void
    logoutAndTryToLogInAs: (username: string) => void
    onEngineConnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    powerMonitorEvent: (event: string) => void
    resetState: (isDebug?: boolean) => void
    remoteWindowNeedsProps: (component: string, params: string) => void
    resetRevokedSelf: () => void
    revoke: (deviceName: string, wasCurrentDevice: boolean) => void
    refreshAccounts: () => Promise<void>
    setAccounts: (a: Store['configuredAccounts']) => void
    setAndroidShare: (s: Store['androidShare']) => void
    setBadgeState: (b: State['badgeState']) => void
    setDefaultUsername: (u: string) => void
    setGlobalError: (e?: unknown) => void
    setGregorReachable: (r: Store['gregorReachable']) => void
    setHTTPSrvInfo: (address: string, token: string) => void
    setIncomingShareUseOriginal: (use: boolean) => void
    setJustDeletedSelf: (s: string) => void
    setLoggedIn: (l: boolean, causedByStartup: boolean, fromMenubar?: boolean) => void
    setStartupDetails: (st: Omit<Store['startup'], 'loaded'>) => void
    setOutOfDate: (outOfDate: T.Config.OutOfDate) => void
    setUpdating: () => void
    setUserSwitching: (sw: boolean) => void
    toggleRuntimeStats: () => void
    updateGregorCategory: (category: string, body: string, dtime?: {offset: number; time: number}) => void
  }
}

export const useConfigState = Z.createZustand<State>('config', (set, get) => {
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
      s.allowAnimatedEmojis = !goodState.find(i => i.item.category === 'emojianimations')
    })
  }

  const updateRuntimeStats = (stats?: T.RPCGen.RuntimeStats) => {
    set(s => {
      s.runtimeStats = stats ? T.castDraft({...s.runtimeStats, ...stats}) : undefined
    })
  }

  const dispatch: State['dispatch'] = {
    checkForUpdate: () => {
      const f = async () => {
        await _checkForUpdate()
      }
      ignorePromise(f())
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
    installerRan: () => {
      set(s => {
        s.installerRanCount++
      })
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
                navigateAppend({name: 'username', params: {username}})
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
    logoutToLoggedOutFlow: () => {
      const f = async () => {
        if (get().loggedIn) {
          await T.RPCGen.loginLogoutRpcPromise(
            {force: false, keepSecrets: true},
            waitingKeyConfigLoginAsOther
          )
        }
      }
      ignorePromise(f())
    },
    onEngineConnected: () => {
      // The startReachability RPC call both starts and returns the current
      // reachability state. Then we'll get updates of changes from this state via reachabilityChanged.
      // This should be run on app start and service re-connect in case the service somehow crashed or was restarted manually.
      const startReachability = async () => {
        try {
          const reachability = await T.RPCGen.reachabilityStartReachabilityRpcPromise()
          get().dispatch.setGregorReachable(reachability.reachable)
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

      onEngineConnectedInPlatform()
      get().dispatch.loadOnStart('initialStartupAsEarlyAsPossible')
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case 'keybase.1.NotifyAudit.rootAuditError':
          get()
            .dispatch.setGlobalError(
              new Error(`Keybase is buggy, please report this: ${action.payload.params.message}`)
            )
          break
        case 'keybase.1.NotifyAudit.boxAuditError':
          get().dispatch.setGlobalError(
            new Error(
              `Keybase had a problem loading a team, please report this with \`keybase log send\`: ${action.payload.params.message}`
            )
          )
          break
        case 'keybase.1.NotifyBadges.badgeState':
          get().dispatch.setBadgeState(action.payload.params.badgeState)
          break
        case 'keybase.1.gregorUI.pushState': {
          const {state} = action.payload.params
          setGregorPushState(state)
          break
        }
        case 'keybase.1.NotifyRuntimeStats.runtimeStatsUpdate': {
          updateRuntimeStats(action.payload.params.stats ?? undefined)
          break
        }
        case 'keybase.1.NotifyService.HTTPSrvInfoUpdate': {
          get().dispatch.setHTTPSrvInfo(action.payload.params.info.address, action.payload.params.info.token)
          break
        }
        case 'keybase.1.NotifySession.loggedIn': {
          logger.info('keybase.1.NotifySession.loggedIn')
          // only send this if we think we're not logged in
          const {loggedIn, dispatch} = get()
          if (!loggedIn) {
            dispatch.setLoggedIn(true, false)
          }
          break
        }
        case 'keybase.1.NotifySession.loggedOut': {
          logger.info('keybase.1.NotifySession.loggedOut')
          const {loggedIn, dispatch} = get()
          // only send this if we think we're logged in (errors on provison can trigger this and mess things up)
          if (loggedIn) {
            dispatch.setLoggedIn(false, false)
          }
          break
        }
        case 'keybase.1.reachability.reachabilityChanged':
          if (get().loggedIn) {
            get().dispatch.setGregorReachable(action.payload.params.reachability.reachable)
          }
          break
        default:
      }
    },
    powerMonitorEvent: event => {
      const f = async () => {
        await T.RPCGen.appStatePowerMonitorEventRpcPromise({event})
      }
      ignorePromise(f())
    },
    refreshAccounts: async () => {
      const defaultUsername = get().defaultUsername
      const configuredAccounts = (await T.RPCGen.loginGetConfiguredAccountsRpcPromise()) ?? []
      const {setAccounts, setDefaultUsername} = get().dispatch

      let existingDefaultFound = false as boolean
      let currentName = ''
      const nextConfiguredAccounts: Array<T.Config.ConfiguredAccount> = []

      configuredAccounts.forEach(account => {
        const {username, isCurrent, fullname, hasStoredSecret} = account
        if (username === defaultUsername) {
          existingDefaultFound = true
        }
        if (isCurrent) {
          currentName = account.username
        }
        nextConfiguredAccounts.push({fullname, hasStoredSecret, username})
      })
      if (!existingDefaultFound) {
        setDefaultUsername(currentName)
      }
      setAccounts(nextConfiguredAccounts)
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
        ...initialStore,
        configuredAccounts: s.configuredAccounts,
        defaultUsername: s.defaultUsername,
        dispatch: s.dispatch,
        startup: {loaded: s.startup.loaded},
        userSwitching: s.userSwitching,
      }))
    },
    revoke: (name, wasCurrentDevice) => {
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
    setGlobalError: _e => {
      if (_e) {
        const e = convertToError(_e)
        set(s => {
          s.globalError = e
        })
        logger.error('Error (global):', e.message, e)
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
    setGregorReachable: r => {
      setGregorReachable(r)
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
    },
    setLoginError: error => {
      set(s => {
        s.loginError = error
      })
      // On login error, turn off the user switching flag, so that the login screen is not
      // hidden and the user can see and respond to the error.
      get().dispatch.setUserSwitching(false)
    },
    setOutOfDate: outOfDate => {
      set(s => {
        Object.assign(s.outOfDate, outOfDate)
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
    setUpdating: () => {
      set(s => {
        s.outOfDate.updating = true
      })
    },
    setUserSwitching: sw => {
      set(s => {
        s.userSwitching = sw
      })
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
  }
  return {
    ...initialStore,
    dispatch,
  }
})
