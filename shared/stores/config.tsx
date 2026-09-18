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
import {type CommonResponseHandler} from '@/engine/types'
import {invalidPasswordErrorString} from '@/constants/config'
import {navigateAppend} from '@/constants/router'
import {onEngineConnected as onEngineConnectedInPlatform} from '@/util/storeless-actions'

type Store = T.Immutable<{
  allowAnimatedEmojis: boolean
  androidShare?:
    | {type: T.RPCGen.IncomingShareType.file; urls: Array<string>}
    | {type: T.RPCGen.IncomingShareType.text; text: string}
  badgeState?: T.RPCGen.BadgeState
  chatBuiltinCommands?: T.Chat.StaticConfig['builtinCommands']
  chatDeletableByDeleteHistory?: Set<T.Chat.MessageType>
  configuredAccounts: Array<T.Config.ConfiguredAccount>
  defaultUsername: string
  globalError?: Error | RPCError
  gregorPushState: Array<{md: T.RPCGregor.Metadata; item: T.RPCGregor.Item}>
  loginError?: RPCError
  httpSrv: {
    address: string
    token: string
  }
  installerRanCount: number
  isOnline: boolean
  justDeletedSelf: string
  justRevokedSelf: string
  loggedIn: boolean
  outOfDate: T.Config.OutOfDate
  revokedTrigger: number
  runtimeStats?: T.RPCGen.RuntimeStats
  startup: {
    loaded: boolean
    conversation: T.Chat.ConversationIDKey
    // uid of the account that persisted `conversation` (from ui.routeState2).
    // Used to avoid replaying a conversation under a different account.
    conversationUid?: string
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
  chatBuiltinCommands: undefined,
  chatDeletableByDeleteHistory: undefined,
  configuredAccounts: [],
  defaultUsername: '',
  globalError: undefined,
  gregorPushState: [],
  httpSrv: {
    address: '',
    token: '',
  },
  installerRanCount: 0,
  isOnline: true,
  justDeletedSelf: '',
  justRevokedSelf: '',
  loggedIn: false,
  loginError: undefined,
  outOfDate: {
    critical: false,
    message: '',
    outOfDate: false,
    updating: false,
  },
  revokedTrigger: 0,
  startup: {
    conversation: noConversationIDKey,
    link: '',
    loaded: false,
  },
  userSwitching: false,
  windowShownCount: new Map(),
}

export type State = Store & {
  dispatch: {
    // an app lifecycle state notification or snapshot: applied only if it is newer than the last
    // applied one. The fan-out is one goroutine per connection, so two of these can arrive in
    // either order, and applying the older one last would leave us permanently wrong.
    acceptAppStateVersion: (version?: T.RPCGen.StateVersion) => boolean
    // a login or logout notification: applied only if it is newer than the last applied one
    acceptSessionVersion: (version?: T.RPCGen.StateVersion) => boolean
    // whether the connected service has told us it cannot settle the session -- see the closure
    sessionIsUnversioned: () => boolean
    setSessionIsUnversioned: (unversioned: boolean) => void
    checkForUpdate: () => void
    initAppUpdateLoop: () => void
    installerRan: () => void
    loadIsOnline: () => void
    login: (username: string, password: string) => void
    setLoginError: (error?: RPCError) => void
    logoutToLoggedOutFlow: () => void
    logoutAndTryToLogInAs: (username: string) => void
    onEngineConnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    powerMonitorEvent: (event: string) => void
    resetState: (isDebug?: boolean) => void
    resetRevokedSelf: () => void
    revoke: (deviceName: string, wasCurrentDevice: boolean) => void
    refreshAccounts: () => Promise<void>
    setAccounts: (a: Store['configuredAccounts']) => void
    setAndroidShare: (s: Store['androidShare']) => void
    setBadgeState: (b: State['badgeState']) => void
    setChatStaticConfig: (s: T.Chat.StaticConfig) => void
    setDefaultUsername: (u: string) => void
    setGlobalError: (e?: unknown) => void
    setHTTPSrvInfo: (address: string, token: string, version?: T.RPCGen.StateVersion) => void
    setJustDeletedSelf: (s: string) => void
    setLoggedIn: (l: boolean) => void
    setStartupDetails: (st: Omit<Store['startup'], 'loaded'>) => void
    setOutOfDate: (outOfDate: T.Config.OutOfDate) => void
    setUpdating: () => void
    setUserSwitching: (sw: boolean) => void
    toggleRuntimeStats: () => void
    updateGregorCategory: (category: string, body: string, dtime?: {offset: number; time: number}) => void
  }
}

// A version we cannot compare is no ordering at all: a service too old to send one, or one built
// from an intermediate commit of this branch, which sends a bare number rather than a record.
const isComparableVersion = (version?: T.RPCGen.StateVersion): version is T.RPCGen.StateVersion =>
  !!version && typeof version.counter === 'number' && typeof version.epoch === 'number'

// A different epoch is a different service process: its counter started over, so
// it is not comparable and its state is by definition the newer one.
const isNewerVersion = (next: T.RPCGen.StateVersion, applied?: T.RPCGen.StateVersion) =>
  next.epoch !== applied?.epoch || next.counter > applied.counter

export const useConfigState = Z.createZustand<State>('config', (set, get) => {
  let inflightRefreshAccounts: Promise<void> | undefined
  // The http server address and the session change at any time and say so with versioned
  // notifications; the setNotifications reply carries both under one version. The service stamps
  // every one of them from one counter, so only a strictly newer version wins. The reply is
  // labelled before the state it carries, so it is never newer than its label: dropping it on a
  // tie loses nothing, because anything it holds beyond its label is a change already on its way
  // as its own notification.
  const applied: {
    appState?: T.RPCGen.StateVersion
    http?: T.RPCGen.StateVersion
    session?: T.RPCGen.StateVersion
  } = {}
  const acceptVersion = (kind: 'appState' | 'http' | 'session', version?: T.RPCGen.StateVersion) => {
    // a service too old to send a version gives us nothing to order by, so everything it sends is
    // applied in the order it arrives, as it was before versions existed
    if (!isComparableVersion(version)) return true
    if (!isNewerVersion(version, applied[kind])) return false
    applied[kind] = version
    return true
  }
  // Set by the init layer from each setNotifications reply: true while the connected service has
  // said it cannot settle the session, which is the only time the unversioned bootstrap status may
  // own it. Cleared here rather than there, the moment a real session version is accepted, because
  // that is the service settling it after all -- an account that is genuinely logged out announces
  // nothing, so the status stays authoritative for it.
  let sessionIsUnversioned = false

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

  const setGregorPushState = (state: T.RPCGen.Gregor1.State) => {
    const items = state.items || []
    const goodState = items.reduce<Array<{md: T.RPCGregor.Metadata; item: T.RPCGregor.Item}>>(
      (arr, {md, item}) => {
        if (md && item) {
          arr.push({item, md})
        }
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
    acceptAppStateVersion: version => acceptVersion('appState', version),
    acceptSessionVersion: version => {
      const accepted = acceptVersion('session', version)
      if (accepted && isComparableVersion(version)) {
        sessionIsUnversioned = false
      }
      return accepted
    },
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
                // this account needs provisioning; hand off to the provision flow
                navigateAppend({name: 'username', params: {autoSubmit: true, username}})
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
          get().dispatch.setLoggedIn(true)
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          if (error.code === T.RPCGen.StatusCode.scalreadyloggedin) {
            get().dispatch.setLoggedIn(true)
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
      // The applied versions are kept: a restarted service announces a different epoch, which is
      // always newer, and a service that is still the same one kept counting across the reconnect.
      // An engine reset drops in-flight RPCs without settling their promises; a refresh
      // caught by that would poison the dedupe cache forever
      inflightRefreshAccounts = undefined

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
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case 'keybase.1.NotifyAudit.rootAuditError':
          get().dispatch.setGlobalError(
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
          const {info, version} = action.payload.params
          get().dispatch.setHTTPSrvInfo(info.address, info.token, version)
          break
        }
        case 'keybase.1.NotifySession.loggedIn': {
          logger.info('keybase.1.NotifySession.loggedIn')
          const {loggedIn, dispatch} = get()
          if (!dispatch.acceptSessionVersion(action.payload.params.version)) {
            logger.info('keybase.1.NotifySession.loggedIn: older than the applied session, ignoring')
            break
          }
          // only send this if we think we're not logged in
          if (!loggedIn) {
            dispatch.setLoggedIn(true)
          }
          break
        }
        case 'keybase.1.NotifySession.loggedOut': {
          logger.info('keybase.1.NotifySession.loggedOut')
          const {loggedIn, dispatch} = get()
          if (!dispatch.acceptSessionVersion(action.payload.params.version)) {
            logger.info('keybase.1.NotifySession.loggedOut: older than the applied session, ignoring')
            break
          }
          // only send this if we think we're logged in (errors on provison can trigger this and mess things up)
          if (loggedIn) {
            dispatch.setLoggedIn(false)
          }
          break
        }
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
      if (inflightRefreshAccounts) {
        return inflightRefreshAccounts
      }
      const f = async () => {
        const defaultUsername = get().defaultUsername
        const configuredAccounts = (await T.RPCGen.loginGetConfiguredAccountsRpcPromise()) ?? []
        const {setAccounts, setDefaultUsername} = get().dispatch

        let existingDefaultFound = false as boolean
        let currentName = ''
        const nextConfiguredAccounts: Array<T.Config.ConfiguredAccount> = []

        configuredAccounts.forEach(account => {
          const {username, isCurrent, fullname, hasStoredSecret, uid} = account
          if (username === defaultUsername) {
            existingDefaultFound = true
          }
          if (isCurrent) {
            currentName = account.username
          }
          nextConfiguredAccounts.push({fullname, hasStoredSecret, uid, username})
        })
        if (!existingDefaultFound) {
          setDefaultUsername(currentName)
        }
        setAccounts(nextConfiguredAccounts)
      }
      const p = f()
      inflightRefreshAccounts = p
      try {
        await p
      } finally {
        if (inflightRefreshAccounts === p) {
          inflightRefreshAccounts = undefined
        }
      }
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
        chatBuiltinCommands: s.chatBuiltinCommands,
        chatDeletableByDeleteHistory: s.chatDeletableByDeleteHistory,
        configuredAccounts: s.configuredAccounts,
        defaultUsername: s.defaultUsername,
        dispatch: s.dispatch,
        // process-wide, not per account; nothing reloads it on logout
        httpSrv: s.httpSrv,
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
      // Compare against committed state, not the draft: immer 11.1.9 sanitizes
      // constructor/prototype access on drafts (prototype-pollution fix), which
      // makes lodash isEqual throw a proxy-invariant TypeError on a draft.
      if (isEqual(a, get().configuredAccounts)) return
      set(s => {
        s.configuredAccounts = T.castDraft(a)
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
    setChatStaticConfig: staticConfig => {
      set(s => {
        s.chatBuiltinCommands = T.castDraft(staticConfig.builtinCommands)
        s.chatDeletableByDeleteHistory = new Set(staticConfig.deletableByDeleteHistory)
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
    setHTTPSrvInfo: (address, token, version) => {
      if (!acceptVersion('http', version)) {
        logger.info(`[HTTPSrv] ignoring ${address}: version ${JSON.stringify(version)} is not newer`)
        return
      }
      set(s => {
        s.httpSrv.address = address
        s.httpSrv.token = token
      })
    },
    sessionIsUnversioned: () => sessionIsUnversioned,
    setJustDeletedSelf: self => {
      set(s => {
        s.justDeletedSelf = self
      })
    },
    setLoggedIn: loggedIn => {
      const changed = get().loggedIn !== loggedIn
      set(s => {
        s.loggedIn = loggedIn
      })
      if (changed && !loggedIn) {
        Z.resetAllStores()
      }
    },
    setLoginError: error => {
      set(s => {
        s.loginError = error
      })
      if (error) {
        get().dispatch.setUserSwitching(false)
      }
    },
    setOutOfDate: outOfDate => {
      set(s => {
        Object.assign(s.outOfDate, outOfDate)
      })
    },
    setSessionIsUnversioned: unversioned => {
      sessionIsUnversioned = unversioned
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
