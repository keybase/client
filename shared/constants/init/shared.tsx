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
import {enqueuePushTapRoute} from '@/router-v2/deep-link-emitter'
import {ignorePromise, timeoutPromise} from '../utils'
import {isPhone, serverConfigFileName} from '../platform'
import {useAvatarState} from '@/common-adapters/avatar/store'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState, type BootstrapStep} from '@/stores/daemon'
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

// The bootstrap read the old gregor-reachability trigger did: after an offline stretch, pick up
// what the service learned while we could not reach it. `previous === undefined` is the first
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
    // a status read before we knew we were logged in was held back then; a status identical to
    // the stored one does not notify again, so apply its identity from here
    applyStatusIdentity(useDaemonState.getState().bootstrapStatus)
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


// Only a status that agrees with the session we are in describes the current user: a read that
// spans a logout describes the previous one, and resetAllStores has already cleared them.
const applyStatusIdentity = (bootstrap: DaemonState['bootstrapStatus']) => {
  if (!bootstrap?.loggedIn || !useConfigState.getState().loggedIn) {
    return
  }
  const {deviceID, deviceName, uid, username} = bootstrap
  useCurrentUserState.getState().dispatch.setBootstrap({deviceID, deviceName, uid, username})
  if (username) {
    useConfigState.getState().dispatch.setDefaultUsername(username)
  }
}

const applyUnversionedStatusSession = (bootstrap: NonNullable<DaemonState['bootstrapStatus']>) => {
  // Only while the connected service has said it cannot settle the session: no setNotifications
  // reply at all (a service too old for it, or a subscribe that failed and left us with no
  // channels either), or a reply taken before the service's startup login attempt had settled.
  // The config store clears this the moment a real session version is accepted, so the fallback
  // hands back to the versioned stream as soon as there is one.
  if (!useConfigState.getState().dispatch.sessionIsUnversioned()) {
    return
  }
  const {httpSrvInfo, loggedIn} = bootstrap
  const configDispatch = useConfigState.getState().dispatch
  if (httpSrvInfo) {
    configDispatch.setHTTPSrvInfo(httpSrvInfo.address, httpSrvInfo.token)
  }
  if (!loggedIn && useConfigState.getState().userSwitching) {
    logger.info('[Bootstrap] ignoring loggedIn=false result during account switch')
    return
  }
  configDispatch.setLoggedIn(loggedIn)
}

export const onBootstrapStatusChanged = (bootstrap: DaemonState['bootstrapStatus']) => {
  if (!bootstrap) {
    return
  }
  // The session first, then the identity, which is applied only if it agrees with the session:
  // the line below may set the session this status describes, and setLoggedIn writes the store
  // synchronously, so the read inside applyStatusIdentity sees it. Nothing outside this function
  // is involved -- swapping these two lines is what would break it.
  applyUnversionedStatusSession(bootstrap)
  applyStatusIdentity(bootstrap)
}

// The service derives the app's lifecycle state from the UI reports native makes and is the only
// party that derives it; this is the whole of JS's model of it. Go's two background states are one
// state here: nothing in the UI distinguishes "backgrounded with work still running" from
// "backgrounded".
//
// Applied only on mobile. Desktop has no lifecycle to report, so the service's value there is a
// constant FOREGROUND that describes nothing -- desktop's window focus is a separate fact, written
// straight to `appFocused` by the window listeners.
export const applyMobileAppState = (state?: T.RPCGen.MobileAppState, version?: T.RPCGen.StateVersion) => {
  if (!isMobile || state === undefined) {
    return
  }
  if (!useConfigState.getState().dispatch.acceptAppStateVersion(version)) {
    logger.info('[AppState] older than the applied state, ignoring')
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
      // a fifth state the service grew and we have not mapped: it has already taken the version,
      // so say so rather than leaving the store silently stuck on the one before it
      logger.warn(`[AppState] unmapped state ${String(state)}, leaving the app state as it was`)
  }
}

// A tapped notification's route waits in the service until this says it has been acted on, which
// is what makes a tap exactly-once. Reading it does not retire it: the peek's reply can be lost on
// the way here, and losing it would lose the tap with nothing anywhere to say so -- the app would
// simply open on the wrong screen. So queue first, then ack, and a peek that never came back
// leaves the route armed for the next one.
//
// Run on connect, for a tap from before this connection (on iOS a background launch never starts a
// client at all, so a tap can be arbitrarily older than the socket), and on pushTapRouteAvailable
// for a tap during it. Both reach the same armed route, so neither can act on a tap the other
// already did.
let enqueuedPushTapID = 0
const takePushTapRoute = async () => {
  if (!isMobile) {
    return
  }
  try {
    const route = await T.RPCGen.appStatePeekPushTapRouteRpcPromise()
    if (!route) {
      return
    }
    // A repeat of a tap this run already queued means only that the ack did not land; re-queueing
    // would navigate a second time, long after the intent store's own duplicate window has passed.
    // A reload resets this, which is right: the intent store was reset with it.
    if (route.id !== enqueuedPushTapID) {
      enqueuedPushTapID = route.id
      enqueuePushTapRoute(route)
    }
    await T.RPCGen.appStateAckPushTapRouteRpcPromise({id: route.id})
  } catch (error) {
    // Nothing is lost by failing here: the route is retired only by an ack that arrived.
    logger.warn('[PushTap] failed to take a tap route, leaving it armed: ', error)
  }
}

// The reply to setNotifications: the state as of the moment this connection subscribed, so there
// is no read to order against the subscription. An old service returns nothing here and the
// bootstrap status keeps that job -- see applyUnversionedStatusSession.
export const applyClientState = (clientState?: T.RPCGen.ClientState, generation?: number) => {
  // A reply from a connection a later handshake has already replaced must not write anything:
  // the flag below has no connection identity of its own, and a rejection delivered a microtask
  // after the reconnect would otherwise re-arm the fallback on the new connection.
  if (generation !== undefined && generation !== useDaemonState.getState().handshakeGeneration) {
    logger.info('[Bootstrap] dropping a subscription reply from a replaced connection')
    return
  }
  const session = clientState?.session
  useConfigState.getState().dispatch.setSessionIsUnversioned(!session)
  if (!clientState || !session) {
    logger.info(
      clientState
        ? '[Bootstrap] setNotifications answered before the login attempt settled; the status owns the session'
        : '[Bootstrap] no client state from setNotifications; this service predates it'
    )
    // the status may already be in the store from before we knew that, and a status identical to
    // the stored one does not notify again
    onBootstrapStatusChanged(useDaemonState.getState().bootstrapStatus)
  }
  if (!clientState) {
    return
  }
  const {appState, httpSrvInfo, version} = clientState
  // On iOS JS never starts on a background launch, so it can have missed every change since the
  // process started: this is what catches it up, and there is no earlier reading to order against.
  // appState is generated as required, but a service older than it omits the field, so it really
  // can be undefined here -- applyMobileAppState is what treats that as "nothing was said".
  applyMobileAppState(appState, version)
  const configDispatch = useConfigState.getState().dispatch
  if (httpSrvInfo) {
    configDispatch.setHTTPSrvInfo(httpSrvInfo.address, httpSrvInfo.token, version)
  }
  if (!session) {
    return
  }
  if (!configDispatch.acceptSessionVersion(version)) {
    logger.info('[Bootstrap] a login or logout is newer than this snapshot, ignoring')
    return
  }
  const {deviceID, deviceName, loggedIn, uid, username} = session
  if (!loggedIn && useConfigState.getState().userSwitching) {
    // policy, not ordering: keep the session and the user we have until the switch lands. The
    // snapshot's identity is empty when it says logged out, so it must not be applied either.
    logger.info('[Bootstrap] ignoring loggedIn=false snapshot during account switch')
    return
  }
  // identity before the session: setLoggedIn fans out synchronously, and every subscriber of a
  // login has always been able to read the current user by the time it runs
  useCurrentUserState.getState().dispatch.setBootstrap({deviceID, deviceName, uid, username})
  if (username) {
    configDispatch.setDefaultUsername(username)
  }
  configDispatch.setLoggedIn(loggedIn)
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
  {
    const subscribe = async (generation: number) => {
      let clientState: T.RPCGen.ClientState | undefined
      try {
        // prettier-ignore
        clientState = await T.RPCGen.notifyCtlSetNotificationsRpcPromise({
          channels: {
            allowChatNotifySkips: true, app: true, audit: true, badges: true, chat: true, chatarchive: true,
            chatattachments: true, chatdev: false, chatemoji: false, chatemojicross: false, chatkbfsedits: false,
            deviceclone: false, ephemeral: false, favorites: false, featuredBots: false, kbfs: true, kbfsdesktop: !isMobile,
            devicehistory: true, kbfslegacy: false, kbfsrequest: false, kbfssubscription: true, keyfamily: false, notifysimplefs: true,
            paperkeys: false, pgp: true, reachability: false, runtimestats: true, saltpack: true, service: true, session: true,
            team: true, teambot: false, tracking: true, users: true, wallet: false,
          },
        })
      } catch (error) {
        if (error) {
          logger.warn('error in toggling notifications: ', error)
        }
        // clientState stays undefined: no reply and no channels either, so nothing versioned will
        // reach this connection and the bootstrap status is all we have, exactly as for a service
        // too old to answer at all
      }
      // outside the try on purpose: a throw from applying a good reply must not be read as a
      // failed subscribe and re-run the unversioned fallback over half-applied versioned state
      applyClientState(clientState, generation)
    }
    // a new connection has told us nothing yet; the reply is what settles it
    useConfigState.getState().dispatch.setSessionIsUnversioned(false)
    ignorePromise(takePushTapRoute())
    // startHandshake first so this connection has its generation before the subscribe goes out.
    // Nothing orders the two RPCs any more: the subscription reply is what carries the session and
    // the http address, so the bootstrap read has nothing left to race with.
    useDaemonState.getState().dispatch.startHandshake()
    ignorePromise(subscribe(useDaemonState.getState().handshakeGeneration))
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
    subscribeValue(useConfigState, s => s.loggedIn, onLoggedInChanged),
    subscribeValue(useConfigState, s => s.revokedTrigger, onRevokedTriggerChanged),
    subscribeValue(useConfigState, s => s.configuredAccounts, onConfiguredAccountsChanged)
  )

  _sharedUnsubs.push(subscribeValue(useDaemonState, s => s.bootstrapStatus, onBootstrapStatusChanged))

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
    case 'keybase.1.NotifyApp.pushTapRouteAvailable':
      ignorePromise(takePushTapRoute())
      break
    case 'keybase.1.NotifyApp.mobileAppStateChanged': {
      const {state, version} = action.payload.params
      applyMobileAppState(state, version)
      break
    }
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
