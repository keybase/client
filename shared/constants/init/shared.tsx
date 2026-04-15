import type * as EngineGen from '@/constants/rpc'
import * as T from '../types'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import * as Tabs from '@/constants/tabs'
declare global {
  var __hmr_startupOnce: boolean | undefined

  var __hmr_sharedUnsubs: Array<() => void> | undefined

  var __hmr_platformUnsubs: Array<() => void> | undefined

  var __hmr_oneTimeInitDone: boolean | undefined

  var __hmr_convoDeferImpl: unknown

  var __hmr_chatStores: Map<unknown, unknown> | undefined

  var __hmr_TBstores: Map<unknown, unknown> | undefined
}
import type * as UseArchiveStateType from '@/stores/archive'
import type * as UseChatStateType from '@/stores/chat'
import type * as UseFSStateType from '@/stores/fs'
import type * as UseNotificationsStateType from '@/stores/notifications'
import type * as UsePeopleStateType from '@/stores/people'
import type * as UsePinentryStateType from '@/stores/pinentry'
import type * as UseSettingsPasswordStateType from '@/stores/settings-password'
import type * as UseTeamsStateType from '@/stores/teams'
import type * as UseTracker2StateType from '@/stores/tracker'
import type * as UnlockFoldersType from '@/stores/unlock-folders'
import type * as UseUsersStateType from '@/stores/users'
import {createTBStore, getTBStore} from '@/stores/team-building'
import {getSelectedConversation} from '@/constants/chat/common'
import * as CryptoRoutes from '@/constants/crypto'
import {emitDeepLink} from '@/router-v2/linking'
import {ignorePromise} from '../utils'
import {isMobile, isPhone, serverConfigFileName} from '../platform'
import {storeRegistry} from '@/stores/store-registry'
import {useAvatarState} from '@/common-adapters/avatar/store'
import {useChatState} from '@/stores/chat'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {useFollowerState} from '@/stores/followers'
import {useModalHeaderState} from '@/stores/modal-header'
import {useProvisionState} from '@/stores/provision'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {useTeamsState} from '@/stores/teams'
import {useRouterState} from '@/stores/router'
import * as Util from '@/constants/router'
import {setConvoDefer} from '@/stores/convostate'
import {clearSignupEmail} from '@/people/signup-email'
import {clearSignupDeviceNameDraft} from '@/signup/device-name-draft'

let _emitStartupOnLoadDaemonConnectedOnce: boolean = __DEV__ ? (globalThis.__hmr_startupOnce ?? false) : false

const _sharedUnsubs: Array<() => void> = __DEV__ ? (globalThis.__hmr_sharedUnsubs ??= []) : []

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
  storeRegistry.getState('daemon').dispatch.startHandshake()
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
  storeRegistry.getState('daemon').dispatch.setError(new Error('Disconnected'))
}

// Initialize team building callbacks. Not ideal but keeping all the existing logic for now.
export const initTeamBuildingCallbacks = () => {
  const commonCallbacks = {
    onAddMembersWizardPushMembers: (members: Array<T.Teams.AddingMember>) => {
      useTeamsState.getState().dispatch.addMembersWizardPushMembers(members)
    },
  }

  const namespaces: Array<T.TB.AllowedNamespace> = ['chat', 'crypto', 'teams', 'people']
  for (const namespace of namespaces) {
    const store = createTBStore(namespace)
    const currentState = store.getState()
    store.setState({
      dispatch: {
        ...currentState.dispatch,
        defer: {
          ...currentState.dispatch.defer,
          ...commonCallbacks,
          ...(namespace === 'chat'
            ? {
                onFinishedTeamBuildingChat: users => {
                  storeRegistry.getState('chat').dispatch.onTeamBuildingFinished(users)
                },
              }
            : {}),
          ...(namespace === 'crypto'
            ? {
                onFinishedTeamBuildingCrypto: users => {
                  const visible = Util.getVisibleScreen()
                  const visibleParams =
                    visible?.name === 'cryptoTeamBuilder'
                      ? (visible.params as {teamBuilderNonce?: string} | undefined)
                      : undefined
                  const teamBuilderUsers = [...users].map(({serviceId, username}) => ({serviceId, username}))
                  Util.clearModals()
                  Util.navigateAppend(
                    {
                      name: CryptoRoutes.encryptTab,
                      params: {
                        teamBuilderNonce: visibleParams?.teamBuilderNonce,
                        teamBuilderUsers,
                      },
                    },
                    true
                  )
                },
              }
            : {}),
        },
      },
    })
  }
}

export const initChat2Callbacks = () => {
  const currentState = useChatState.getState()
  useChatState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        onGetTeamsTeamIDToMembers: (teamID: T.Teams.TeamID) => {
          return storeRegistry.getState('teams').teamIDToMembers.get(teamID)
        },
        onTeamsGetMembers: async (teamID: T.Teams.TeamID) => {
          return storeRegistry.getState('teams').dispatch.getMembers(teamID)
        },
        onTeamsUpdateTeamRetentionPolicy: (metas: ReadonlyArray<T.Chat.ConversationMeta>) => {
          storeRegistry.getState('teams').dispatch.updateTeamRetentionPolicy(metas)
        },
      },
    },
  })
}

export const initSharedSubscriptions = () => {
  // HMR cleanup: unsubscribe old store subscriptions before re-subscribing
  for (const unsub of _sharedUnsubs) unsub()
  _sharedUnsubs.length = 0

  setConvoDefer({
    chatBlockButtonsMapHas: teamID => storeRegistry.getState('chat').blockButtonsMap.has(teamID),
    chatInboxLayoutSmallTeamsFirstConvID: () =>
      storeRegistry.getState('chat').inboxLayout?.smallTeams?.[0]?.convID,
    chatInboxRefresh: reason => storeRegistry.getState('chat').dispatch.inboxRefresh(reason),
    chatMetasReceived: metas => storeRegistry.getState('chat').dispatch.metasReceived(metas),
    chatNavigateToInbox: Util.navigateToInbox,
    chatPreviewConversation: Util.previewConversation,
    chatUnboxRows: (convIDs, force) => storeRegistry.getState('chat').dispatch.unboxRows(convIDs, force),
    teamsGetMembers: async teamID => storeRegistry.getState('teams').dispatch.getMembers(teamID),
    usersGetBio: username => storeRegistry.getState('users').dispatch.getBio(username),
  })
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

          const updateTeams = () => {
            useTeamsState.getState().dispatch.getTeams()
            useTeamsState.getState().dispatch.refreshTeamRoleMap()
          }

          const updateSettings = () => {
            useSettingsContactsState.getState().dispatch.loadContactImportEnabled()
          }

          const updateChat = () => {
            // On phone, let the focused inbox screen trigger the first refresh so hidden chatRoot
            // mounts behind a pushed conversation do not pay inbox startup cost.
            if (!isPhone && useCurrentUserState.getState().username) {
              const {inboxRefresh} = useChatState.getState().dispatch
              inboxRefresh('bootstrap')
            }
          }

          getFollowerInfo()
          ignorePromise(updateServerConfig())
          updateTeams()
          updateSettings()
          updateChat()
        }
      }

      if (s.gregorReachable !== old.gregorReachable) {
        // Re-get info about our account if you log in/we're done handshaking/became reachable
        if (s.gregorReachable === T.RPCGen.Reachable.yes) {
          // not in waiting state
          if (storeRegistry.getState('daemon').handshakeWaiters.size === 0) {
            ignorePromise(storeRegistry.getState('daemon').dispatch.loadDaemonBootstrapStatus())
          }
          storeRegistry.getState('teams').dispatch.eagerLoadTeams()
        }
      }

      if (s.installerRanCount !== old.installerRanCount) {
        storeRegistry.getState('fs').dispatch.checkKbfsDaemonRpcStatus()
      }

      if (s.loggedIn !== old.loggedIn) {
        if (s.loggedIn) {
          ignorePromise(storeRegistry.getState('daemon').dispatch.loadDaemonBootstrapStatus())
          storeRegistry.getState('fs').dispatch.checkKbfsDaemonRpcStatus()
        } else {
          clearSignupEmail()
          clearSignupDeviceNameDraft()
        }
        storeRegistry
          .getState('daemon')
          .dispatch.loadDaemonAccounts(
            s.configuredAccounts.length,
            s.loggedIn,
            useConfigState.getState().dispatch.refreshAccounts
          )
        if (!s.loggedInCausedbyStartup) {
          ignorePromise(useConfigState.getState().dispatch.refreshAccounts())
        }
      }

      if (s.revokedTrigger !== old.revokedTrigger) {
        storeRegistry
          .getState('daemon')
          .dispatch.loadDaemonAccounts(
            s.configuredAccounts.length,
            s.loggedIn,
            useConfigState.getState().dispatch.refreshAccounts
          )
      }

      if (s.configuredAccounts !== old.configuredAccounts) {
        const updates = s.configuredAccounts.map(account => ({
          info: {fullname: account.fullname ?? ''},
          name: account.username,
        }))
        if (updates.length > 0) {
          storeRegistry.getState('users').dispatch.updates(updates)
        }
      }

      if (s.active !== old.active) {
        const cs = storeRegistry.getConvoState(getSelectedConversation())
        cs.dispatch.markThreadAsRead()
      }
    })
  )

  _sharedUnsubs.push(
    useDaemonState.subscribe((s, old) => {
      if (s.handshakeVersion !== old.handshakeVersion) {
        useDarkModeState.getState().dispatch.loadDarkPrefs()
        storeRegistry.getState('chat').dispatch.loadStaticConfig()
        const configState = useConfigState.getState()
        s.dispatch.loadDaemonAccounts(
          configState.configuredAccounts.length,
          configState.loggedIn,
          useConfigState.getState().dispatch.refreshAccounts
        )
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

          storeRegistry.getState('chat').dispatch.updateUserReacjis(userReacjis)
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
        storeRegistry.getState('fs').criticalUpdate
      ) {
        const {dispatch} = storeRegistry.getState('fs')
        dispatch.setCriticalUpdate(false)
      }
      const fsRrouteNames = ['fsRoot', 'barePreview']
      const wasScreen = fsRrouteNames.includes(Util.getVisibleScreen(prev)?.name ?? '')
      const isScreen = fsRrouteNames.includes(Util.getVisibleScreen(next)?.name ?? '')
      if (wasScreen !== isScreen) {
        const {dispatch} = storeRegistry.getState('fs')
        if (wasScreen) {
          dispatch.userOut()
        } else {
          dispatch.userIn()
        }
      }

      // Clear "just signed up email" when you leave the people tab after signup
      if (prev && Util.getTab(prev) === Tabs.peopleTab && next && Util.getTab(next) !== Tabs.peopleTab) {
        clearSignupEmail()
      }

      if (prev && Util.getTab(prev) === Tabs.peopleTab && next && Util.getTab(next) !== Tabs.peopleTab) {
        storeRegistry.getState('people').dispatch.markViewed()
      }

      if (prev && Util.getTab(prev) === Tabs.teamsTab && next && Util.getTab(next) !== Tabs.teamsTab) {
        storeRegistry.getState('teams').dispatch.clearNavBadges()
      }

      // Clear "check your inbox" in settings when you leave the settings tab
      if (
        prev &&
        Util.getTab(prev) === Tabs.settingsTab &&
        next &&
        Util.getTab(next) !== Tabs.settingsTab &&
        storeRegistry.getState('settings-email').addedEmail
      ) {
        storeRegistry.getState('settings-email').dispatch.resetAddedEmail()
      }

      storeRegistry.getState('chat').dispatch.onRouteChanged(prev, next)
    })
  )

  initChat2Callbacks()
  initTeamBuildingCallbacks()
}

// This is to defer loading stores we don't need immediately.
export const _onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case 'keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged':
    case 'chat.1.NotifyChat.ChatArchiveComplete':
    case 'chat.1.NotifyChat.ChatArchiveProgress':
      {
        const {useArchiveState} = require('@/stores/archive') as typeof UseArchiveStateType
        useArchiveState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.NotifyBadges.badgeState':
      {
        const {badgeState} = action.payload.params
        useModalHeaderState
          .getState()
          .dispatch.setDeviceBadges(
            new Set([...(badgeState.newDevices ?? []), ...(badgeState.revokedDevices ?? [])])
          )

        const {useNotifState} = require('@/stores/notifications') as typeof UseNotificationsStateType
        useNotifState.getState().dispatch.onEngineIncomingImpl(action)

        const {useFSState} = require('@/stores/fs') as typeof UseFSStateType
        useFSState.getState().dispatch.onEngineIncomingImpl(action)

        const {useTeamsState} = require('@/stores/teams') as typeof UseTeamsStateType
        useTeamsState.getState().dispatch.onEngineIncomingImpl(action)

        const {useChatState} = require('@/stores/chat') as typeof UseChatStateType
        useChatState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'chat.1.chatUi.chatShowManageChannels':
    case 'keybase.1.NotifyTeam.teamMetadataUpdate':
    case 'chat.1.NotifyChat.ChatWelcomeMessageLoaded':
    case 'keybase.1.NotifyTeam.teamTreeMembershipsPartial':
    case 'keybase.1.NotifyTeam.teamTreeMembershipsDone':
    case 'keybase.1.NotifyTeam.teamRoleMapChanged':
    case 'keybase.1.NotifyTeam.teamChangedByID':
    case 'keybase.1.NotifyTeam.teamDeleted':
    case 'keybase.1.NotifyTeam.teamExit':
    case 'keybase.1.gregorUI.pushState':
      {
        const {useTeamsState} = require('@/stores/teams') as typeof UseTeamsStateType
        useTeamsState.getState().dispatch.onEngineIncomingImpl(action)
        const {useChatState} = require('@/stores/chat') as typeof UseChatStateType
        useChatState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.NotifyFS.FSOverallSyncStatusChanged':
    case 'keybase.1.NotifyFS.FSSubscriptionNotifyPath':
    case 'keybase.1.NotifyFS.FSSubscriptionNotify':
      {
        const {useFSState} = require('@/stores/fs') as typeof UseFSStateType
        useFSState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.homeUI.homeUIRefresh':
      {
        const {usePeopleState} = require('@/stores/people') as typeof UsePeopleStateType
        usePeopleState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.NotifyEmailAddress.emailAddressVerified':
      {
        const emailAddress = action.payload.params.emailAddress
        if (emailAddress) {
          storeRegistry.getState('settings-email').dispatch.notifyEmailVerified(emailAddress)
        }
        clearSignupEmail()
      }
      break
    case 'keybase.1.secretUi.getPassphrase':
      {
        const {usePinentryState} = require('@/stores/pinentry') as typeof UsePinentryStateType
        usePinentryState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case 'keybase.1.NotifyUsers.passwordChanged':
      {
        const randomPW = action.payload.params.state === T.RPCGen.PassphraseState.random
        const {usePWState} = require('@/stores/settings-password') as typeof UseSettingsPasswordStateType
        usePWState.getState().dispatch.notifyUsersPasswordChanged(randomPW)
      }
      break
    case 'keybase.1.NotifyPhoneNumber.phoneNumbersChanged': {
      const {list} = action.payload.params
      storeRegistry
        .getState('settings-phone')
        .dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined)
      break
    }
    case 'keybase.1.NotifyEmailAddress.emailsChanged': {
      const list = action.payload.params.list ?? []
      storeRegistry.getState('settings-email').dispatch.notifyEmailAddressEmailsChanged(list)
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
    case 'chat.1.chatUi.chatMaybeMentionUpdate':
    case 'chat.1.NotifyChat.ChatConvUpdate':
    case 'chat.1.chatUi.chatCoinFlipStatus':
    case 'chat.1.NotifyChat.ChatThreadsStale':
    case 'chat.1.NotifyChat.ChatSubteamRename':
    case 'chat.1.NotifyChat.ChatTLFFinalize':
    case 'chat.1.NotifyChat.ChatIdentifyUpdate':
    case 'chat.1.chatUi.chatInboxUnverified':
    case 'chat.1.NotifyChat.ChatInboxSyncStarted':
    case 'chat.1.NotifyChat.ChatInboxSynced':
    case 'chat.1.chatUi.chatInboxLayout':
    case 'chat.1.NotifyChat.ChatInboxStale':
    case 'chat.1.chatUi.chatInboxConversation':
    case 'chat.1.NotifyChat.NewChatActivity':
    case 'chat.1.NotifyChat.ChatTypingUpdate':
    case 'chat.1.NotifyChat.ChatSetConvRetention':
    case 'chat.1.NotifyChat.ChatSetTeamRetention':
      {
        const {useChatState} = require('@/stores/chat') as typeof UseChatStateType
        useChatState.getState().dispatch.onEngineIncomingImpl(action)
      }
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
      const {useTrackerState} = require('@/stores/tracker') as typeof UseTracker2StateType
      useTrackerState.getState().dispatch.onEngineIncomingImpl(action)
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
    case 'keybase.1.identify3Ui.identify3Result':
    case 'keybase.1.identify3Ui.identify3ShowTracker':
    case 'keybase.1.NotifyUsers.userChanged':
    case 'keybase.1.NotifyTracking.notifyUserBlocked':
    case 'keybase.1.identify3Ui.identify3UpdateRow':
    case 'keybase.1.identify3Ui.identify3UserReset':
    case 'keybase.1.identify3Ui.identify3UpdateUserCard':
    case 'keybase.1.identify3Ui.identify3Summary':
      {
        const {useTrackerState} = require('@/stores/tracker') as typeof UseTracker2StateType
        useTrackerState.getState().dispatch.onEngineIncomingImpl(action)
      }
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
    case 'keybase.1.rekeyUI.refresh':
    case 'keybase.1.rekeyUI.delegateRekeyUI':
      {
        const {onUnlockFoldersEngineIncoming} = require('@/stores/unlock-folders') as typeof UnlockFoldersType
        onUnlockFoldersEngineIncoming(action)
      }
      break
    default:
  }
  useConfigState.getState().dispatch.onEngineIncoming(action)
}
