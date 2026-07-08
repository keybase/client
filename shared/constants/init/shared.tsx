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
import type * as UseBlockButtonsStateType from '@/chat/blocking/block-buttons-state'
import type * as UseNotificationsStateType from '@/stores/notifications'
import type * as UseUsersStateType from '@/stores/users'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {serviceStaticConfigToStaticConfig} from '@/constants/chat/static-config'
import {emitDeepLink} from '@/router-v2/linking'
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
    const {useBlockButtonsState} = require(
      '@/chat/blocking/block-buttons-state'
    ) as typeof UseBlockButtonsStateType
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
  if (loggedIn) {
    configDispatch.setUserSwitching(false)
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
    case 'keybase.1.NotifyBadges.badgeState':
      {
        const {badgeState} = action.payload.params
        syncInboxBadgeState(badgeState)
        const {useNotifState} = require('@/stores/notifications') as typeof UseNotificationsStateType
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
      const {useBlockButtonsState} = require(
        '@/chat/blocking/block-buttons-state'
      ) as typeof UseBlockButtonsStateType
      useBlockButtonsState.getState().dispatch.updateFromGregorItems(state.items)

      const {useNotifState} = require('@/stores/notifications') as typeof UseNotificationsStateType
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
        const {useUsersState} = require('@/stores/users') as typeof UseUsersStateType
        useUsersState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.NotifyUsers.identifyUpdate':
      {
        const {useUsersState} = require('@/stores/users') as typeof UseUsersStateType
        useUsersState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
  useConfigState.getState().dispatch.onEngineIncoming(action)
  notifyEngineActionListeners(action)
}
