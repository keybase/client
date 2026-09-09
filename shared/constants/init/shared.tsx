import * as T from '../types'
import logger from '@/logger'
import * as Tabs from '@/constants/tabs'
declare global {
  var __hmr_sharedUnsubs: Array<() => void> | undefined

  var __hmr_platformUnsubs: Array<() => void> | undefined

  var __hmr_oneTimeInitDone: boolean | undefined

  var __hmr_TBstores: Map<unknown, unknown> | undefined
}
import {useBlockButtonsState} from '@/chat/blocking/block-buttons-state'

// Engine handler manifest. Each of these modules registers its own handlers for
// the engine actions it owns when it is first imported; importing them here is
// what guarantees that happens before the engine starts delivering.
import '@/chat/blocking/block-buttons-state'
import '@/chat/inbox/badge-state'
import '@/chat/inbox/engine'
import '@/chat/inbox/metadata'
import '@/common-adapters/avatar/store'
import '@/router-v2/deep-link-emitter'
import '@/stores/config'
import '@/stores/followers-engine'
import '@/stores/notifications'
import '@/stores/settings-email'
import '@/stores/settings-phone'
import '@/stores/users'
import {serviceStaticConfigToStaticConfig} from '@/constants/chat/static-config'
import {ignorePromise, timeoutPromise} from '../utils'
import {isPhone, serverConfigFileName} from '../platform'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState, type BootstrapStep} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {useShellState} from '@/stores/shell'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {useUsersState} from '@/stores/users'
import {useRouterState} from '@/stores/router'
import * as Util from '@/constants/router'
import {onChatRouteChanged} from '@/chat/inbox/metadata'
import {clearSignupEmail} from '@/people/signup-email'
import {clearSignupDeviceNameDraft} from '@/signup/device-name-draft'
import {clearNavBadges} from '@/teams/actions'

const _sharedUnsubs: Array<() => void> = __DEV__ ? (globalThis.__hmr_sharedUnsubs ??= []) : []

type SubscribeStore<State> = {
  subscribe: (listener: (state: State, previousState: State) => void) => () => void
}

const subscribeValue = <State, Value>(
  store: SubscribeStore<State>,
  select: (state: State) => Value,
  onChange: (value: Value, previous: Value) => void
) =>
  store.subscribe((state, previousState) => {
    const value = select(state)
    const previous = select(previousState)
    if (value !== previous) {
      onChange(value, previous)
    }
  })

type ConfigState = ReturnType<typeof useConfigState.getState>
type DaemonState = ReturnType<typeof useDaemonState.getState>
type RouterState = ReturnType<typeof useRouterState.getState>

// ─── Bootstrap steps ──────────────────────────────────────────────────────────
// Gating steps for the daemon handshake, run by useDaemonState.dispatch.startHandshake after
// bootstrapStatus loads. Throwing fails the attempt and triggers a retry.

const loadDarkPrefsStep = async () => {
  useDarkModeState.getState().dispatch.loadDarkPrefs()
  return Promise.resolve()
}

const loadChatStaticConfigStep = async () => {
  const {chatBuiltinCommands, chatDeletableByDeleteHistory} = useConfigState.getState()
  if (chatBuiltinCommands && chatDeletableByDeleteHistory) {
    return
  }
  const staticConfig = serviceStaticConfigToStaticConfig(await T.RPCChat.localGetStaticConfigRpcPromise())
  if (!staticConfig) {
    logger.error('chat.loadStaticConfig: missing required static config')
    return
  }
  useConfigState.getState().dispatch.setChatStaticConfig(staticConfig)
}

const loadAccountsStep = async () => {
  const refreshAccounts = useConfigState.getState().dispatch.refreshAccounts
  if (useDaemonState.getState().bootstrapStatus?.loggedIn) {
    // logged in: the account list only feeds the switcher, don't gate startup on it
    ignorePromise(refreshAccounts().catch(() => {}))
    return
  }
  try {
    await refreshAccounts()
  } catch {
    throw new Error("Can't get accounts")
  }
}

const requestFollowerInfoForStartup = () => {
  const {uid} = useCurrentUserState.getState()
  logger.info(`getFollowerInfo: init; uid=${uid}`)
  if (uid) {
    // request follower info in the background
    T.RPCGen.configRequestFollowingAndUnverifiedFollowersRpcPromise()
      .then(() => {})
      .catch(() => {})
  }
}

const updateServerConfigForStartup = async () => {
  if (useConfigState.getState().loggedIn) {
    try {
      await T.RPCGen.configUpdateLastLoggedInAndServerConfigRpcPromise({
        serverConfigPath: serverConfigFileName,
      })
    } catch {}
  }
}

const loadStartupSettings = () => {
  useSettingsContactsState.getState().dispatch.loadContactImportEnabled()
}

const refreshStartupChat = () => {
  // On phone, let the focused inbox screen trigger the first refresh so hidden chatRoot
  // mounts behind a pushed conversation do not pay inbox startup cost.
  if (!isPhone && useCurrentUserState.getState().username) {
    ignorePromise(useInboxLayoutState.getState().dispatch.refresh('bootstrap'))
  }
}

// Loads that want a logged-in user but shouldn't compete with first paint
const scheduleStartupOrReloginWork = () => {
  const f = async () => {
    await timeoutPromise(1000)
    requestAnimationFrame(() => {
      requestFollowerInfoForStartup()
      ignorePromise(updateServerConfigForStartup())
      loadStartupSettings()
      refreshStartupChat()
    })
  }
  ignorePromise(f())
}

const onGregorReachableChanged = (gregorReachable: ConfigState['gregorReachable']) => {
  // Re-get info about our account if you log in/we're done handshaking/became reachable
  if (
    gregorReachable === T.RPCGen.Reachable.yes &&
    useDaemonState.getState().handshakeState === 'done' &&
    !useConfigState.getState().userSwitching
  ) {
    ignorePromise(useDaemonState.getState().dispatch.loadDaemonBootstrapStatus())
  }
}

const onLoggedInChanged = (loggedIn: ConfigState['loggedIn']) => {
  if (loggedIn) {
    // runtime login: refresh bootstrap status. During the handshake this is already in
    // flight, and the store dedupes it.
    ignorePromise(useDaemonState.getState().dispatch.loadDaemonBootstrapStatus())
    scheduleStartupOrReloginWork()
  } else {
    clearSignupEmail()
    clearSignupDeviceNameDraft()
    useBlockButtonsState.getState().dispatch.resetState()
  }
  ignorePromise(useConfigState.getState().dispatch.refreshAccounts())
}

const onRevokedTriggerChanged = () => {
  ignorePromise(useConfigState.getState().dispatch.refreshAccounts())
}

const onConfiguredAccountsChanged = (configuredAccounts: ConfigState['configuredAccounts']) => {
  const updates = configuredAccounts.map(account => ({
    info: {fullname: account.fullname ?? ''},
    name: account.username,
  }))
  if (updates.length > 0) {
    useUsersState.getState().dispatch.updates(updates)
  }
}

const onBootstrapStatusChanged = (bootstrap: DaemonState['bootstrapStatus']) => {
  if (!bootstrap) {
    return
  }

  const {deviceID, deviceName, loggedIn, uid, username} = bootstrap
  useCurrentUserState.getState().dispatch.setBootstrap({deviceID, deviceName, uid, username})

  const configDispatch = useConfigState.getState().dispatch
  if (username) {
    configDispatch.setDefaultUsername(username)
  }
  if (!loggedIn && useConfigState.getState().userSwitching) {
    logger.info('[Bootstrap] ignoring loggedIn=false result during account switch')
    return
  }
  configDispatch.setLoggedIn(loggedIn)

  if (bootstrap.httpSrvInfo) {
    configDispatch.setHTTPSrvInfo(bootstrap.httpSrvInfo.address, bootstrap.httpSrvInfo.token)
  }
}

const onNavStateChanged =(nextNavState: RouterState['navState'], previousNavState: RouterState['navState']) => {
  const next = nextNavState as Util.NavState
  const prev = previousNavState as Util.NavState
  if (prev === next) return

  // Clear critical update when we nav away from tab
  if (
    prev &&
    Util.getTab(prev) === Tabs.fsTab &&
    next &&
    Util.getTab(next) !== Tabs.fsTab &&
    useShellState.getState().fsCriticalUpdate
  ) {
    const {dispatch} = useShellState.getState()
    dispatch.setFsCriticalUpdate(false)
  }

  if (prev && Util.getTab(prev) === Tabs.teamsTab && next && Util.getTab(next) !== Tabs.teamsTab) {
    clearNavBadges()
  }

  onChatRouteChanged(prev, next)
}

export const onEngineConnected = () => {
  {
    const registerUIs = async () => {
      try {
        await T.RPCGen.delegateUiCtlRegisterChatUIRpcPromise()
        await T.RPCGen.delegateUiCtlRegisterLogUIRpcPromise()
        logger.info('Registered Chat UI')
        await T.RPCGen.delegateUiCtlRegisterHomeUIRpcPromise()
        logger.info('Registered home UI')
        await T.RPCGen.delegateUiCtlRegisterSecretUIRpcPromise()
        logger.info('Registered secret ui')
        await T.RPCGen.delegateUiCtlRegisterIdentify3UIRpcPromise()
        logger.info('Registered identify ui')
        await T.RPCGen.delegateUiCtlRegisterRekeyUIRpcPromise()
        logger.info('Registered rekey ui')
      } catch (error) {
        logger.error('Error in registering UIs:', error)
      }
    }
    ignorePromise(registerUIs())
  }
  useConfigState.getState().dispatch.onEngineConnected()
  useDaemonState.getState().dispatch.startHandshake()
  {
    const notifyCtl = async () => {
      try {
        // prettier-ignore
        await T.RPCGen.notifyCtlSetNotificationsRpcPromise({
          channels: {
            allowChatNotifySkips: true, app: true, audit: true, badges: true, chat: true, chatarchive: true,
            chatattachments: true, chatdev: false, chatemoji: false, chatemojicross: false, chatkbfsedits: false,
            deviceclone: false, ephemeral: false, favorites: false, featuredBots: false, kbfs: true, kbfsdesktop: !isMobile,
            devicehistory: true, kbfslegacy: false, kbfsrequest: false, kbfssubscription: true, keyfamily: false, notifysimplefs: true,
            paperkeys: false, pgp: true, reachability: true, runtimestats: true, saltpack: true, service: true, session: true,
            team: true, teambot: false, tracking: true, users: true, wallet: false,
          },
        })
      } catch (error) {
        if (error) {
          logger.warn('error in toggling notifications: ', error)
        }
      }
    }
    ignorePromise(notifyCtl())
  }
}

export const onEngineDisconnected = () => {
  const f = async () => {
    await logger.dump()
  }
  ignorePromise(f())
  useDaemonState.getState().dispatch.setError(new Error('Disconnected'))
}

export const initSharedSubscriptions = (platformBootstrapSteps: Array<BootstrapStep> = []) => {
  useDaemonState
    .getState()
    .dispatch.initBootstrapSteps([
      loadDarkPrefsStep,
      loadChatStaticConfigStep,
      loadAccountsStep,
      ...platformBootstrapSteps,
    ])

  // HMR cleanup: unsubscribe old store subscriptions before re-subscribing
  for (const unsub of _sharedUnsubs) unsub()
  _sharedUnsubs.length = 0
  _sharedUnsubs.push(
    subscribeValue(useConfigState, s => s.gregorReachable, onGregorReachableChanged),
    subscribeValue(useConfigState, s => s.loggedIn, onLoggedInChanged),
    subscribeValue(useConfigState, s => s.revokedTrigger, onRevokedTriggerChanged),
    subscribeValue(useConfigState, s => s.configuredAccounts, onConfiguredAccountsChanged)
  )

  _sharedUnsubs.push(subscribeValue(useDaemonState, s => s.bootstrapStatus, onBootstrapStatusChanged))

  _sharedUnsubs.push(
    subscribeValue(useRouterState, s => s.navState, onNavStateChanged)
  )
}
