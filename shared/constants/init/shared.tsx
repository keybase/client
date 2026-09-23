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
import {getPinnedConvIDs} from '@/chat/inbox/pinned-convs'
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
import {
  ackPushTap,
  addAppLifecycleListener,
  addPushTapListener,
  getAppLifecycleState,
  peekPushTap,
  type AppLifecycleState,
} from 'react-native-kb'
import {parsePushTapPayload, pushTapField, resolvePushTap, type PushTapPayload} from './push-tap-resolve'

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

// After an offline stretch, reread the session to pick up what the service learned while we could
// not reach it. `previous === undefined` is the first reading of the network at startup, which the
// handshake's own read already covers.
export const onNetworkOnlineChanged = (online?: boolean, previous?: boolean) => {
  if (!online || previous !== false) {
    return
  }
  if (useDaemonState.getState().handshakeState === 'done' && !useConfigState.getState().userSwitching) {
    useDaemonState.getState().dispatch.refreshSessionFromDaemon('back online')
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
  const configDispatch = useConfigState.getState().dispatch

  // Before the identity: the user we hold is what tells the new account's session from the old.
  // onUserSwitchingChanged applies the status once the switch ends.
  if (!loggedIn && useConfigState.getState().userSwitching) {
    logger.info('[Bootstrap] ignoring loggedIn=false result during account switch')
    return
  }

  // Logged in as someone else than the user we hold is a logout and then a login, however the
  // notifications in between reached us. Logging out clears the previous account's stores, the
  // daemon's status among them, so put this status back and let that change apply it.
  const currentUid = useCurrentUserState.getState().uid
  if (loggedIn && useConfigState.getState().loggedIn && currentUid && uid !== currentUid) {
    logger.info('[Bootstrap] the session is another user now, logging out the previous one')
    configDispatch.setLoggedIn(false)
    useDaemonState.getState().dispatch.setBootstrapStatus(bootstrap)
    return
  }

  useCurrentUserState.getState().dispatch.setBootstrap({deviceID, deviceName, uid, username})
  if (username) {
    configDispatch.setDefaultUsername(username)
  }
  configDispatch.setLoggedIn(loggedIn)

  if (bootstrap.httpSrvInfo) {
    configDispatch.setHTTPSrvInfo(bootstrap.httpSrvInfo.address, bootstrap.httpSrvInfo.token)
  }
}

// A switch that failed after the service logged out has a logged-out status nothing applied, and
// a read after the switch returns the same status, which does not count as a change.
const onUserSwitchingChanged = (userSwitching: ConfigState['userSwitching']) => {
  if (!userSwitching) {
    onBootstrapStatusChanged(useDaemonState.getState().bootstrapStatus)
  }
}

// Native reports the app state from the same callbacks that report it to Go, and this is the only
// writer of mobileAppState. Desktop has no lifecycle; its window focus goes straight to appFocused.
export const applyMobileAppState = (state: AppLifecycleState) => {
  if (!isMobile) return
  useShellState.getState().dispatch.setMobileAppState(state)
}

const isMobileAppState = (s: string): s is AppLifecycleState =>
  s === 'active' || s === 'inactive' || s === 'background'

const onNativeAppLifecycle = (state: string) => {
  logger.info(`[AppState] native: ${state}`)
  if (isMobileAppState(state)) {
    applyMobileAppState(state)
  } else {
    logger.warn(`[AppState] unmapped state ${state}, leaving the app state as it was`)
  }
}

// Subscribe before seeding: events emitted while no listener existed are only in the seed, and one
// emitted after the seed read reaches the listener later on this thread.
export const listenForAppLifecycle = (): (() => void) => {
  const stop = addAppLifecycleListener(onNativeAppLifecycle)
  const initial: string = getAppLifecycleState()
  if (isMobileAppState(initial)) {
    applyMobileAppState(initial)
  }
  return stop
}

const membersTypeOf = (t: string): T.RPCChat.ConversationMembersType | undefined => {
  switch (parseInt(t, 10)) {
    case T.RPCChat.ConversationMembersType.kbfs:
      return T.RPCChat.ConversationMembersType.kbfs
    case T.RPCChat.ConversationMembersType.team:
      return T.RPCChat.ConversationMembersType.team
    case T.RPCChat.ConversationMembersType.impteamnative:
      return T.RPCChat.ConversationMembersType.impteamnative
    case T.RPCChat.ConversationMembersType.impteamupgrade:
      return T.RPCChat.ConversationMembersType.impteamupgrade
    default:
      return undefined
  }
}

// An Android push is a data message Go displayed itself, so a tapped chat push's message is unboxed
// into the thread here. It waits for the account the push names, which after a cold tap or an
// account switch is not current yet.
let pendingPushTapUnbox:
  | {params: {convID: string; membersType: T.RPCChat.ConversationMembersType; payload: string}; uid: string}
  | undefined

const unboxPushTapIfAccountCurrent = () => {
  const pending = pendingPushTapUnbox
  if (!pending) return
  const {uid} = useCurrentUserState.getState()
  if (!uid || (pending.uid && pending.uid !== uid)) return
  pendingPushTapUnbox = undefined
  T.RPCChat.localUnboxMobilePushNotificationRpcPromise(pending.params).catch(() => {
    logger.info('[PushTap] failed to unbox message from payload')
  })
}

const queuePushTapUnbox = (payload: PushTapPayload) => {
  const get = (key: string) => pushTapField(payload, key)
  const convID = get('convID')
  const boxed = get('m')
  const membersType = membersTypeOf(get('t'))
  if (get('type') !== 'chat.newmessage' || !convID || !boxed || membersType === undefined) return
  pendingPushTapUnbox = {params: {convID, membersType, payload: boxed}, uid: get('uid')}
  unboxPushTapIfAccountCurrent()
}

// Native holds a tapped notification until it is acked by id, so a peek never loses one: the
// same tap peeked again (a repeated event, a JS reload) carries the same id, which the intent
// store turns away. A tap that opens nothing is acked here; one that does is acked by whatever
// consumes or drops its intent.
let lastTakenPushTapID: number | undefined
const takePushTap = () => {
  const tap = peekPushTap()
  if (!tap) return
  const payload = parsePushTapPayload(tap.payload)
  const route = payload && resolvePushTap(payload)
  if (!payload || !route) {
    logger.info('[PushTap] a tap with no route, only opening the app')
    ackPushTap(tap.id)
    return
  }
  const firstTake = lastTakenPushTapID !== tap.id
  lastTakenPushTapID = tap.id
  enqueuePushTapRoute({id: tap.id, targetUid: route.targetUid, url: route.url})
  if (firstTake && isAndroid) {
    queuePushTapUnbox(payload)
  }
}

// Subscribe before peeking: a tap held before JS listened is only seen by the peek, and one that
// lands after the peek reaches the listener.
export const listenForPushTaps = (): (() => void) => {
  const stopTaps = addPushTapListener(takePushTap)
  const stopUnbox = useCurrentUserState.subscribe(unboxPushTapIfAccountCurrent)
  takePushTap()
  return () => {
    stopTaps()
    stopUnbox()
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
            paperkeys: false, pgp: true, reachability: false, runtimestats: true, saltpack: true, service: true, session: true,
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
    subscribeValue(useConfigState, s => s.gregorPushState, onGregorPushStateChanged),
    subscribeValue(useConfigState, s => s.loggedIn, onLoggedInChanged),
    subscribeValue(useConfigState, s => s.revokedTrigger, onRevokedTriggerChanged),
    subscribeValue(useConfigState, s => s.configuredAccounts, onConfiguredAccountsChanged),
    subscribeValue(useConfigState, s => s.userSwitching, onUserSwitchingChanged)
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
    // These can reach us out of order with each other, so none of them sets the session: each only
    // says it changed, and the daemon's reply to the latest read is what applies.
    case 'keybase.1.NotifySession.loggedIn':
    case 'keybase.1.NotifySession.loggedOut':
    case 'keybase.1.NotifyService.HTTPSrvInfoUpdate':
      useDaemonState.getState().dispatch.refreshSessionFromDaemon(action.type)
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
