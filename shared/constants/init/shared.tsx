import type * as EngineGen from '@/constants/rpc'
import * as T from '../types'
import * as S from '@/constants/strings'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import * as Tabs from '@/constants/tabs'
declare global {
  var __hmr_startupOnce: boolean | undefined

  var __hmr_sharedUnsubs: Array<() => void> | undefined

  var __hmr_platformUnsubs: Array<() => void> | undefined

  var __hmr_oneTimeInitDone: boolean | undefined

  var __hmr_chatStores: Map<unknown, unknown> | undefined

  var __hmr_TBstores: Map<unknown, unknown> | undefined
}
import type * as UseChatStateType from '@/stores/chat'
import type * as UseNotificationsStateType from '@/stores/notifications'
import type * as UseUsersStateType from '@/stores/users'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {getTBStore} from '@/stores/team-building'
import {getSelectedConversation} from '@/constants/chat/common'
import {emitDeepLink} from '@/router-v2/linking'
import {ignorePromise} from '../utils'
import {isMobile, isPhone, serverConfigFileName} from '../platform'
import {useAvatarState} from '@/common-adapters/avatar/store'
import {useChatState} from '@/stores/chat'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {useFollowerState} from '@/stores/followers'
import {useFSState} from '@/stores/fs'
import {useModalHeaderState} from '@/stores/modal-header'
import {useProvisionState} from '@/stores/provision'
import {useShellState} from '@/stores/shell'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {useUsersState} from '@/stores/users'
import {useWaitingState} from '@/stores/waiting'
import {useRouterState} from '@/stores/router'
import * as Util from '@/constants/router'
import {
  getConvoState,
  onChatInboxSynced,
  onGetInboxConvsUnboxed,
  onGetInboxUnverifiedConvs,
  onInboxLayoutChanged,
  onIncomingInboxUIItem,
  handleConvoEngineIncoming,
  onRouteChanged as onConvoRouteChanged,
  syncBadgeState,
  syncGregorExplodingModes,
} from '@/stores/convostate'
import {clearSignupEmail} from '@/people/signup-email'
import {clearSignupDeviceNameDraft} from '@/signup/device-name-draft'
import {clearNavBadges} from '@/teams/actions'

let _emitStartupOnLoadDaemonConnectedOnce: boolean = __DEV__ ? (globalThis.__hmr_startupOnce ?? false) : false

const _sharedUnsubs: Array<() => void> = __DEV__ ? (globalThis.__hmr_sharedUnsubs ??= []) : []
const getAccountsWaitKey = 'config.getAccounts'

const loadConfiguredAccountsForBootstrap = () => {
  const configState = useConfigState.getState()
  if (configState.configuredAccounts.length) {
    return
  }

  const version = useDaemonState.getState().handshakeVersion
  const handshakeWait = !configState.loggedIn
  const refreshAccounts = configState.dispatch.refreshAccounts
  const {wait} = useDaemonState.getState().dispatch

  const f = async () => {
    try {
      if (handshakeWait) {
        wait(getAccountsWaitKey, version, true)
      }

      await refreshAccounts()

      if (handshakeWait && useDaemonState.getState().handshakeWaiters.get(getAccountsWaitKey)) {
        wait(getAccountsWaitKey, version, false)
      }
    } catch {
      if (handshakeWait && useDaemonState.getState().handshakeWaiters.get(getAccountsWaitKey)) {
        wait(getAccountsWaitKey, version, false, "Can't get accounts")
      }
    }
  }

  ignorePromise(f())
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
            kbfslegacy: false, kbfsrequest: false, kbfssubscription: true, keyfamily: false, notifysimplefs: true,
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

export const initSharedSubscriptions = () => {
  // HMR cleanup: unsubscribe old store subscriptions before re-subscribing
  for (const unsub of _sharedUnsubs) unsub()
  _sharedUnsubs.length = 0
  _sharedUnsubs.push(
    useConfigState.subscribe((s, old) => {
      if (s.loadOnStartPhase !== old.loadOnStartPhase) {
        if (s.loadOnStartPhase === 'startupOrReloginButNotInARush') {
          const getFollowerInfo = () => {
            const {uid} = useCurrentUserState.getState()
            logger.info(`getFollowerInfo: init; uid=${uid}`)
            if (uid) {
              // request follower info in the background
              T.RPCGen.configRequestFollowingAndUnverifiedFollowersRpcPromise()
                .then(() => {})
                .catch(() => {})
            }
          }

          const updateServerConfig = async () => {
            if (s.loggedIn) {
              try {
                await T.RPCGen.configUpdateLastLoggedInAndServerConfigRpcPromise({
                  serverConfigPath: serverConfigFileName,
                })
              } catch {}
            }
          }

          const updateSettings = () => {
            useSettingsContactsState.getState().dispatch.loadContactImportEnabled()
          }

          const updateChat = () => {
            // On phone, let the focused inbox screen trigger the first refresh so hidden chatRoot
            // mounts behind a pushed conversation do not pay inbox startup cost.
            if (!isPhone && useCurrentUserState.getState().username) {
              const {inboxRefresh} = useChatState.getState().dispatch
              ignorePromise(inboxRefresh('bootstrap'))
            }
          }

          getFollowerInfo()
          ignorePromise(updateServerConfig())
          updateSettings()
          updateChat()
        }
      }

      if (s.gregorReachable !== old.gregorReachable) {
        // Re-get info about our account if you log in/we're done handshaking/became reachable
        if (s.gregorReachable === T.RPCGen.Reachable.yes) {
          // not in waiting state
          if (useDaemonState.getState().handshakeWaiters.size === 0) {
            ignorePromise(useDaemonState.getState().dispatch.loadDaemonBootstrapStatus())
          }
        }
      }

      if (s.installerRanCount !== old.installerRanCount) {
        useFSState.getState().dispatch.checkKbfsDaemonRpcStatus()
      }

      if (s.loggedIn !== old.loggedIn) {
        if (s.loggedIn) {
          ignorePromise(useDaemonState.getState().dispatch.loadDaemonBootstrapStatus())
          useFSState.getState().dispatch.checkKbfsDaemonRpcStatus()
        } else {
          clearSignupEmail()
          clearSignupDeviceNameDraft()
        }
        loadConfiguredAccountsForBootstrap()
        if (!s.loggedInCausedbyStartup) {
          ignorePromise(useConfigState.getState().dispatch.refreshAccounts())
        }
      }

      if (s.revokedTrigger !== old.revokedTrigger) {
        loadConfiguredAccountsForBootstrap()
      }

      if (s.configuredAccounts !== old.configuredAccounts) {
        const updates = s.configuredAccounts.map(account => ({
          info: {fullname: account.fullname ?? ''},
          name: account.username,
        }))
        if (updates.length > 0) {
          useUsersState.getState().dispatch.updates(updates)
        }
      }

    })
  )

  _sharedUnsubs.push(
    useShellState.subscribe((s, old) => {
      if (s.active !== old.active) {
        const cs = getConvoState(getSelectedConversation())
        cs.dispatch.markThreadAsRead()
      }
    })
  )

  _sharedUnsubs.push(
    useDaemonState.subscribe((s, old) => {
      if (s.handshakeVersion !== old.handshakeVersion) {
        useDarkModeState.getState().dispatch.loadDarkPrefs()
        useChatState.getState().dispatch.loadStaticConfig()
        loadConfiguredAccountsForBootstrap()
      }

      if (s.bootstrapStatus !== old.bootstrapStatus) {
        const bootstrap = s.bootstrapStatus
        if (bootstrap) {
          const {deviceID, deviceName, loggedIn, uid, username, userReacjis} = bootstrap
          useCurrentUserState.getState().dispatch.setBootstrap({deviceID, deviceName, uid, username})

          const configDispatch = useConfigState.getState().dispatch
          if (username) {
            configDispatch.setDefaultUsername(username)
          }
          if (loggedIn) {
            configDispatch.setUserSwitching(false)
          }
          configDispatch.setLoggedIn(loggedIn, false)

          if (bootstrap.httpSrvInfo) {
            configDispatch.setHTTPSrvInfo(bootstrap.httpSrvInfo.address, bootstrap.httpSrvInfo.token)
          }

          useChatState.getState().dispatch.updateUserReacjis(userReacjis)
        }
      }

      if (s.handshakeState !== old.handshakeState) {
        if (s.handshakeState === 'done') {
          if (!_emitStartupOnLoadDaemonConnectedOnce) {
            _emitStartupOnLoadDaemonConnectedOnce = true
            if (__DEV__) globalThis.__hmr_startupOnce = true
            useConfigState.getState().dispatch.loadOnStart('connectedToDaemonForFirstTime')
          }
        }
      }
    })
  )

  _sharedUnsubs.push(
    useProvisionState.subscribe((s, old) => {
      if (s.startProvisionTrigger !== old.startProvisionTrigger) {
        useConfigState.getState().dispatch.setLoginError()
        useConfigState.getState().dispatch.resetRevokedSelf()
        const f = async () => {
          // If we're logged in, we're coming from the user switcher; log out first to prevent the service from getting out of sync with the GUI about our logged-in-ness
          if (useConfigState.getState().loggedIn) {
            await T.RPCGen.loginLogoutRpcPromise({force: false, keepSecrets: true}, 'config:loginAsOther')
          }
        }
        ignorePromise(f())
      }
    })
  )

  _sharedUnsubs.push(
    useRouterState.subscribe((s, old) => {
      const next = s.navState as Util.NavState
      const prev = old.navState as Util.NavState
      if (prev === next) return

      const namespaces = ['chat', 'crypto', 'teams', 'people'] as const
      const namespaceToRoute = new Map([
        ['chat', 'chatNewChat'],
        ['crypto', 'cryptoTeamBuilder'],
        ['teams', 'teamsTeamBuilder'],
        ['people', 'peopleTeamBuilder'],
      ])
      for (const namespace of namespaces) {
        const wasTeamBuilding = namespaceToRoute.get(namespace) === Util.getVisibleScreen(prev)?.name
        if (wasTeamBuilding) {
          // team building or modal on top of that still
          const isTeamBuilding = namespaceToRoute.get(namespace) === Util.getVisibleScreen(next)?.name
          if (!isTeamBuilding) {
            getTBStore(namespace).dispatch.cancelTeamBuilding()
          }
        }
      }

      // Clear critical update when we nav away from tab
      if (
        prev &&
        Util.getTab(prev) === Tabs.fsTab &&
        next &&
        Util.getTab(next) !== Tabs.fsTab &&
        useFSState.getState().criticalUpdate
      ) {
        const {dispatch} = useFSState.getState()
        dispatch.setCriticalUpdate(false)
      }
      const fsRrouteNames = ['fsRoot', 'barePreview']
      const wasScreen = fsRrouteNames.includes(Util.getVisibleScreen(prev)?.name ?? '')
      const isScreen = fsRrouteNames.includes(Util.getVisibleScreen(next)?.name ?? '')
      if (wasScreen !== isScreen) {
        const {dispatch} = useFSState.getState()
        if (wasScreen) {
          dispatch.userOut()
        } else {
          dispatch.userIn()
        }
      }

      if (prev && Util.getTab(prev) === Tabs.teamsTab && next && Util.getTab(next) !== Tabs.teamsTab) {
        clearNavBadges()
      }

      onConvoRouteChanged(prev, next)
    })
  )
}

// This is to defer loading stores we don't need immediately.
export const _onEngineIncoming = (action: EngineGen.Actions) => {
  const routeConvoEngineIncoming = (engineAction: EngineGen.Actions) => {
    const result = handleConvoEngineIncoming(engineAction, useChatState.getState().staticConfig)
    if (result.inboxUIItem) {
      onIncomingInboxUIItem(result.inboxUIItem)
    }
    if (result.userReacjis) {
      useChatState.getState().dispatch.updateUserReacjis(result.userReacjis)
    }
  }

  switch (action.type) {
    case 'keybase.1.NotifyBadges.badgeState':
      {
        const {badgeState} = action.payload.params
        syncBadgeState(badgeState)
        useModalHeaderState
          .getState()
          .dispatch.setDeviceBadges(
            new Set([...(badgeState.newDevices ?? []), ...(badgeState.revokedDevices ?? [])])
          )

        const {useNotifState} = require('@/stores/notifications') as typeof UseNotificationsStateType
        useNotifState.getState().dispatch.onEngineIncomingImpl(action)

        const {useChatState} = require('@/stores/chat') as typeof UseChatStateType
        useChatState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.NotifyTeam.teamMetadataUpdate':
    case 'keybase.1.NotifyTeam.teamChangedByID':
      {
        const {useChatState} = require('@/stores/chat') as typeof UseChatStateType
        useChatState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.NotifyTeam.teamRoleMapChanged':
      {
        const {useChatState} = require('@/stores/chat') as typeof UseChatStateType
        useChatState.getState().dispatch.onEngineIncomingImpl(action)
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
      syncGregorExplodingModes(goodState)

      const {useNotifState} = require('@/stores/notifications') as typeof UseNotificationsStateType
      useNotifState.getState().dispatch.onEngineIncomingImpl(action)
      const {useChatState} = require('@/stores/chat') as typeof UseChatStateType
      useChatState.getState().dispatch.onEngineIncomingImpl(action)
      break
    }
    case 'chat.1.NotifyChat.ChatSetTeamRetention':
      {
        routeConvoEngineIncoming(action)
      }
      break
    case 'keybase.1.NotifyFS.FSOverallSyncStatusChanged':
      {
        useFSState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.NotifyFS.FSSubscriptionNotify':
      {
        switch (action.payload.params.topic) {
          case T.RPCGen.SubscriptionTopic.journalStatus:
          case T.RPCGen.SubscriptionTopic.onlineStatus:
          case T.RPCGen.SubscriptionTopic.downloadStatus:
          case T.RPCGen.SubscriptionTopic.uploadStatus:
          case T.RPCGen.SubscriptionTopic.settings: {
            useFSState.getState().dispatch.onEngineIncomingImpl(action)
            break
          }
          default:
        }
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
    case 'chat.1.chatUi.chatBotCommandsUpdateStatus':
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
    case 'chat.1.chatUi.chatMaybeMentionUpdate':
    case 'chat.1.NotifyChat.ChatIdentifyUpdate':
    case 'chat.1.NotifyChat.ChatInboxStale':
      {
        const {useChatState} = require('@/stores/chat') as typeof UseChatStateType
        useChatState.getState().dispatch.onEngineIncomingImpl(action)
      }
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
        onChatInboxSynced(action, async reason => useChatState.getState().dispatch.inboxRefresh(reason))
      )
      break
    case 'chat.1.chatUi.chatInboxLayout': {
      const {inboxHasLoaded, dispatch} = useChatState.getState()
      dispatch.updateInboxLayout(action.payload.params.layout)
      const {inboxLayout} = useChatState.getState()
      if (inboxLayout) {
        onInboxLayoutChanged(inboxLayout, inboxHasLoaded)
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
