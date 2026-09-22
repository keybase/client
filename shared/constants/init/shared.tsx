import type * as EngineGen from '@/constants/rpc'
import * as T from '../types'
import * as S from '@/constants/strings'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import * as Tabs from '@/constants/tabs'
declare global {
  var __hmr_sharedUnsubs: Array<() => void> | undefined

  var __hmr_platformUnsubs: Array<() => void> | undefined

  var __hmr_oneTimeInitDone: boolean | undefined

  var __hmr_TBstores: Map<unknown, unknown> | undefined
}
import {useBlockButtonsState} from '@/chat/blocking/block-buttons-state'
import {useNotifState} from '@/stores/notifications'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {serviceStaticConfigToStaticConfig} from '@/constants/chat/static-config'
import {emitDeepLink} from '@/router-v2/linking'
import {ignorePromise, timeoutPromise} from '../utils'
import {isLinux, isPhone, serverConfigFileName} from '../platform'
import {useAvatarState} from '@/common-adapters/avatar/store'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {getPinnedConvIDs} from '@/chat/inbox/pinned-convs'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {FatalHandshakeError, useDaemonState, type BootstrapStep} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {useFollowerState} from '@/stores/followers'
import {useShellState} from '@/stores/shell'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {useUsersState} from '@/stores/users'
import {useWaitingState} from '@/stores/waiting'
import {useRouterState} from '@/stores/router'
import * as Util from '@/constants/router'
import {handleConvoEngineIncoming} from '@/chat/inbox/engine'
import {
  onChatRouteChanged,
  onChatInboxSynced,
  onGetInboxConvsUnboxed,
  onGetInboxUnverifiedConvs,
  onInboxLayoutChanged,
  onIncomingInboxUIItem,
} from '@/chat/inbox/metadata'
import {syncInboxBadgeState} from '@/chat/inbox/badge-state'
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

export const loadAccountsStep = async () => {
  const refreshAccounts = useConfigState.getState().dispatch.refreshAccounts
  // refreshAccounts is local (config/keychain + offline uidmap). Handshake must
  // not await it while logged in or switching; the logged-out picker still
  // awaits so the list is not empty.
  if (
    useDaemonState.getState().bootstrapStatus?.loggedIn ||
    useConfigState.getState().userSwitching
  ) {
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

// Go reads pins from gregor while building the inbox layout, but gregor state only exists once
// the service connects, and items that arrive in the connect-time sync don't reach the in-band
// handlers. The GUI gets the synced state pushed afterwards, so rebuild when the pins in it change.
const onGregorPushStateChanged = (
  pushState: ConfigState['gregorPushState'],
  previous: ConfigState['gregorPushState']
) => {
  if (!useConfigState.getState().loggedIn) return
  if (isEqual(getPinnedConvIDs(pushState), getPinnedConvIDs(previous))) return
  ignorePromise(
    T.RPCChat.localRequestInboxLayoutRpcPromise({reselectMode: T.RPCChat.InboxLayoutReselectMode.default})
  )
}

// After an offline stretch, reread the bootstrap status to pick up what the service learned while
// we could not reach it. `previous === undefined` is the first
// reading of the network at startup, which the handshake's own read already covers.
export const onNetworkOnlineChanged = (online?: boolean, previous?: boolean) => {
  if (!online || previous !== false) {
    return
  }
  if (
    useDaemonState.getState().handshakeState === 'done' &&
    !useConfigState.getState().userSwitching
  ) {
    ignorePromise(useDaemonState.getState().dispatch.loadDaemonBootstrapStatus())
  }
}

export const onLoggedInChanged = (loggedIn: ConfigState['loggedIn']) => {
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


// The service derives the app's lifecycle state from the UI reports native makes and is the only
// party that derives it; this is the whole of JS's model of it. Go's two background states are one
// state here: nothing in the UI distinguishes "backgrounded with work still running" from
// "backgrounded".
//
// Applied only on mobile. Desktop has no lifecycle to report, so the service's value there is a
// constant FOREGROUND that describes nothing -- desktop's window focus is a separate fact, written
// straight to `appFocused` by the window listeners.
export const applyMobileAppState = (state: T.RPCGen.MobileAppState) => {
  if (!isMobile) {
    return
  }
  switch (state) {
    case T.RPCGen.MobileAppState.foreground:
      useShellState.getState().dispatch.setMobileAppState('active')
      break
    case T.RPCGen.MobileAppState.inactive:
      useShellState.getState().dispatch.setMobileAppState('inactive')
      break
    case T.RPCGen.MobileAppState.background:
    case T.RPCGen.MobileAppState.backgroundactive:
      useShellState.getState().dispatch.setMobileAppState('background')
      break
    default:
      // a fifth state the service grew and we have not mapped: say so rather than leaving the store
      // silently stuck on the one before it
      logger.warn(`[AppState] unmapped state ${String(state)}, leaving the app state as it was`)
  }
}

// The splash waits for the service to say who is logged in. A clientState with no session means
// its startup login attempt has not settled yet -- not known, rather than logged out -- and the
// attempt settling sends another that has one. Each connection waits afresh.
const sessionWaitMs = 30_000
let settleSession = () => {}
let sessionSettled = new Promise<void>(resolve => {
  settleSession = resolve
})
// Subscribing makes the service send a clientState, so on desktop none at all means a service
// older than clientState. On Linux the GUI can be upgraded while such a service keeps running.
let clientStateSeen = false
const awaitSessionAgain = () => {
  clientStateSeen = false
  sessionSettled = new Promise<void>(resolve => {
    settleSession = resolve
  })
}

// The service's clientState: the session, the http server address and the app state, read when it
// was sent. It rides the same ordered stream as every notification that changes them, and for each
// of them the last message to arrive carries the latest value, so everything is applied in arrival
// order. It comes first on subscribing, after every session change, and once the service's startup
// login attempt settles.
export const applyClientState = (clientState: T.RPCGen.ClientState) => {
  clientStateSeen = true
  const {appState, httpSrvInfo, session} = clientState
  // On iOS JS never starts on a background launch, so it can have missed every change since the
  // process started: this is what catches it up.
  applyMobileAppState(appState)
  const configDispatch = useConfigState.getState().dispatch
  if (httpSrvInfo) {
    configDispatch.setHTTPSrvInfo(httpSrvInfo.address, httpSrvInfo.token)
  }
  if (!session) {
    logger.info('[Bootstrap] the service has not settled its startup login yet')
    return
  }
  settleSession()
  const {deviceID, deviceName, loggedIn, uid, username} = session
  if (!loggedIn) {
    // Session first: logging out resets the stores, the current user among them. Writing the empty
    // identity first would leave a moment where we are logged in with no user.
    configDispatch.setLoggedIn(false)
    return
  }
  // A logged-in clientState for another user than the one we are logged in as is a logout and then
  // a login, however it reached us -- with or without a logged-out clientState before it. Logging
  // out is what clears the previous account's stores. Logged in with no current user is no switch.
  const currentUid = useCurrentUserState.getState().uid
  if (useConfigState.getState().loggedIn && currentUid && uid !== currentUid) {
    configDispatch.setLoggedIn(false)
  }
  // identity before the session: setLoggedIn fans out synchronously, and every subscriber of a
  // login has always been able to read the current user by the time it runs
  useCurrentUserState.getState().dispatch.setBootstrap({deviceID, deviceName, uid, username})
  if (username) {
    configDispatch.setDefaultUsername(username)
  }
  configDispatch.setLoggedIn(true)
}

const subscribe = async () => {
  try {
    // prettier-ignore
    await T.RPCGen.notifyCtlSetNotificationsRpcPromise({
      channels: {
        allowChatNotifySkips: true, app: true, audit: true, badges: true, chat: true, chatarchive: true,
        chatattachments: true, chatdev: false, chatemoji: false, chatemojicross: false, chatkbfsedits: false,
        deviceclone: false, ephemeral: false, favorites: false, featuredBots: false, kbfs: true, kbfsdesktop: !isMobile,
        devicehistory: true, kbfslegacy: false, kbfsrequest: false, kbfssubscription: true, keyfamily: false, notifysimplefs: true,
        paperkeys: false, pgp: true, reachability: false, runtimestats: true, saltpack: true, service: true, session: true,
        team: true, teambot: false, tracking: true, users: true, wallet: false,
      },
    })
    return true
  } catch (error) {
    logger.warn('error in toggling notifications: ', error)
    return false
  }
}
let subscription = Promise.resolve(false)

// A handshake step: the session is what decides between the login screen and the app. A failed
// subscribe, or a wait that timed out, subscribes again here, since that is what sends a clientState.
export const sessionSettledStep = async () => {
  if (!(await subscription)) {
    subscription = subscribe()
    if (!(await subscription)) {
      throw new Error("Can't subscribe to the service's notifications")
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("The service hasn't said who is logged in")), sessionWaitMs)
  })
  try {
    await Promise.race([sessionSettled, timedOut])
  } catch (error) {
    // Subscribing again makes the service send a fresh clientState, so the retry isn't waiting
    // on one that was lost.
    subscription = Promise.resolve(false)
    // the mobile service runs in-process, so it is always the same build
    if (clientStateSeen || isMobile) {
      throw error
    }
    throw new FatalHandshakeError(
      isLinux
        ? 'The Keybase service is out of date. Restart it with run_keybase.'
        : 'The Keybase service is out of date. Restart Keybase.'
    )
  } finally {
    clearTimeout(timer)
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

  useConfigState.getState().dispatch.onEngineConnected()

  awaitSessionAgain()
  subscription = subscribe()
  useDaemonState.getState().dispatch.startHandshake()
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
      sessionSettledStep,
      ...platformBootstrapSteps,
    ])

  // HMR cleanup: unsubscribe old store subscriptions before re-subscribing
  for (const unsub of _sharedUnsubs) unsub()
  _sharedUnsubs.length = 0
  _sharedUnsubs.push(
    subscribeValue(useConfigState, s => s.gregorPushState, onGregorPushStateChanged),
    subscribeValue(useConfigState, s => s.loggedIn, onLoggedInChanged),
    subscribeValue(useConfigState, s => s.revokedTrigger, onRevokedTriggerChanged),
    subscribeValue(useConfigState, s => s.configuredAccounts, onConfiguredAccountsChanged)
  )

  _sharedUnsubs.push(subscribeValue(useShellState, s => s.networkStatus?.online, onNetworkOnlineChanged))

  _sharedUnsubs.push(
    subscribeValue(useRouterState, s => s.navState, onNavStateChanged)
  )
}

// This is to defer loading stores we don't need immediately.
export const _onEngineIncoming = (action: EngineGen.Actions) => {
  const routeConvoEngineIncoming = (engineAction: EngineGen.Actions) => {
    const result = handleConvoEngineIncoming(engineAction)
    if (result.inboxUIItem) {
      onIncomingInboxUIItem(result.inboxUIItem)
    }
    if (result.userReacjis) {
      useDaemonState.getState().dispatch.updateUserReacjis(result.userReacjis)
    }
  }

  switch (action.type) {
    case 'keybase.1.NotifyApp.mobileAppStateChanged':
      applyMobileAppState(action.payload.params.state)
      break
    case 'keybase.1.NotifyApp.clientState':
      applyClientState(action.payload.params.state)
      break
    case 'keybase.1.NotifyBadges.badgeState':
      {
        const {badgeState} = action.payload.params
        syncInboxBadgeState(badgeState)
        useNotifState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.gregorUI.pushState': {
      const {state} = action.payload.params
      const items = state.items || []
      const goodState = items.reduce<Array<{md: T.RPCGen.Gregor1.Metadata; item: T.RPCGen.Gregor1.Item}>>(
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
      useBlockButtonsState.getState().dispatch.updateFromGregorItems(state.items)

      useNotifState.getState().dispatch.onEngineIncomingImpl(action)
      break
    }
    case 'chat.1.NotifyChat.ChatSetTeamRetention':
      {
        routeConvoEngineIncoming(action)
      }
      break
    case 'keybase.1.NotifyEmailAddress.emailAddressVerified':
      {
        const emailAddress = action.payload.params.emailAddress
        if (emailAddress) {
          useSettingsEmailState.getState().dispatch.notifyEmailVerified(emailAddress)
        }
        clearSignupEmail()
      }
      break
    case 'keybase.1.NotifyPhoneNumber.phoneNumbersChanged': {
      const {list} = action.payload.params
      useSettingsPhoneState.getState().dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined)
      break
    }
    case 'keybase.1.NotifyEmailAddress.emailsChanged': {
      const list = action.payload.params.list ?? []
      useSettingsEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(list)
      break
    }
    case 'chat.1.chatUi.chatInboxFailed':
    case 'chat.1.NotifyChat.ChatSetConvSettings':
    case 'chat.1.NotifyChat.ChatAttachmentUploadStart':
    case 'chat.1.NotifyChat.ChatPromptUnfurl':
    case 'chat.1.NotifyChat.ChatPaymentInfo':
    case 'chat.1.NotifyChat.ChatRequestInfo':
    case 'chat.1.NotifyChat.ChatAttachmentDownloadProgress':
    case 'chat.1.NotifyChat.ChatAttachmentDownloadComplete':
    case 'chat.1.NotifyChat.ChatAttachmentUploadProgress':
    case 'chat.1.chatUi.chatCommandMarkdown':
    case 'chat.1.chatUi.chatGiphyToggleResultWindow':
    case 'chat.1.chatUi.chatCommandStatus':
    case 'chat.1.chatUi.chatGiphySearchResults':
    case 'chat.1.NotifyChat.ChatParticipantsInfo':
    case 'chat.1.NotifyChat.ChatConvUpdate':
    case 'chat.1.chatUi.chatCoinFlipStatus':
    case 'chat.1.NotifyChat.ChatThreadsStale':
    case 'chat.1.NotifyChat.ChatSubteamRename':
    case 'chat.1.NotifyChat.ChatTLFFinalize':
    case 'chat.1.NotifyChat.NewChatActivity':
    case 'chat.1.NotifyChat.ChatTypingUpdate':
    case 'chat.1.NotifyChat.ChatSetConvRetention':
      routeConvoEngineIncoming(action)
      break
    case 'chat.1.NotifyChat.ChatIdentifyUpdate': {
      const {update} = action.payload.params
      const usernames = update.CanonicalName.split(',')
      const broken = (update.breaks.breaks || []).map(b => b.user.username)
      const updates = usernames.map(name => ({info: {broken: broken.includes(name)}, name}))
      useUsersState.getState().dispatch.updates(updates)
      break
    }
    case 'chat.1.NotifyChat.ChatInboxStale':
      ignorePromise(useInboxLayoutState.getState().dispatch.refresh('inboxStale'))
      break
    case 'chat.1.chatUi.chatInboxUnverified':
      onGetInboxUnverifiedConvs(action)
      break
    case 'chat.1.NotifyChat.ChatInboxSyncStarted':
      useWaitingState.getState().dispatch.increment(S.waitingKeyChatInboxSyncStarted)
      break
    case 'chat.1.NotifyChat.ChatInboxSynced':
      useWaitingState.getState().dispatch.clear(S.waitingKeyChatInboxSyncStarted)
      ignorePromise(
        onChatInboxSynced(action, async reason => useInboxLayoutState.getState().dispatch.refresh(reason))
      )
      break
    case 'chat.1.chatUi.chatInboxLayout': {
      const {hasLoaded, dispatch} = useInboxLayoutState.getState()
      dispatch.updateLayout(action.payload.params.layout)
      const {layout} = useInboxLayoutState.getState()
      if (layout) {
        onInboxLayoutChanged(layout, hasLoaded)
      }
      break
    }
    case 'chat.1.chatUi.chatInboxConversation':
      onGetInboxConvsUnboxed(action)
      break
    case 'keybase.1.NotifyService.handleKeybaseLink':
      {
        const {link, deferred} = action.payload.params
        if (deferred && !link.startsWith('keybase://team-invite-link/')) {
          return
        }
        // Route through the linking config; it falls back to handleAppLink
        // for URL patterns not handled declaratively.
        const fullUrl = link.startsWith('keybase://') ? link : `keybase://${link}`
        emitDeepLink(fullUrl)
      }
      break
    case 'keybase.1.NotifyTeam.avatarUpdated': {
      const {name} = action.payload.params
      useAvatarState.getState().dispatch.updated(name)
      break
    }
    case 'keybase.1.NotifyTracking.trackingChanged': {
      const {isTracking, username} = action.payload.params
      useFollowerState.getState().dispatch.updateFollowing(username, isTracking)
      break
    }
    case 'keybase.1.NotifyTracking.trackingInfo': {
      const {uid, followers: _newFollowers, followees: _newFollowing} = action.payload.params
      if (useCurrentUserState.getState().uid !== uid) {
        break
      }
      const newFollowers = new Set(_newFollowers)
      const newFollowing = new Set(_newFollowing)
      const {following: oldFollowing, followers: oldFollowers, dispatch} = useFollowerState.getState()
      const following = isEqual(newFollowing, oldFollowing) ? oldFollowing : newFollowing
      const followers = isEqual(newFollowers, oldFollowers) ? oldFollowers : newFollowers
      dispatch.replace(followers, following)
      break
    }
    case 'keybase.1.NotifyTracking.notifyUserBlocked':
      {
        useUsersState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.NotifyUsers.identifyUpdate':
      {
        useUsersState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
  useConfigState.getState().dispatch.onEngineIncoming(action)
  notifyEngineActionListeners(action)
}
