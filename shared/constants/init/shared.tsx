import * as EngineGen from '@/actions/engine-gen-gen'
import logger from '@/logger'
import {isMobile, serverConfigFileName} from '../platform'
import * as T from '../types'
import {ignorePromise} from '../utils'
import type * as UseArchiveStateType from '@/stores/archive'
import type * as UseAutoResetStateType from '@/stores/autoreset'
import type * as UseDevicesStateType from '@/stores/devices'
import {useAvatarState} from '@/common-adapters/avatar/store'
import type * as UseBotsStateType from '@/stores/bots'
import {useChatState} from '@/stores/chat2'
import {getSelectedConversation} from '@/constants/chat2/common'
import type * as UseChatStateType from '@/stores/chat2'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {handleKeybaseLink} from '../deeplinks'
import {useFollowerState} from '@/stores/followers'
import isEqual from 'lodash/isEqual'
import type * as UseFSStateType from '@/stores/fs'
import type * as UseGitStateType from '@/stores/git'
import type * as UseNotificationsStateType from '@/stores/notifications'
import type * as UsePeopleStateType from '@/stores/people'
import type * as UsePinentryStateType from '@/stores/pinentry'
import {useProvisionState} from '@/stores/provision'
import {storeRegistry} from '@/stores/store-registry'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import type * as UseSignupStateType from '@/stores/signup'
import type * as UseTeamsStateType from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'
import type * as UseTracker2StateType from '@/stores/tracker2'
import type * as UseUnlockFoldersStateType from '@/stores/unlock-folders'
import type * as UseUsersStateType from '@/stores/users'
import {useWhatsNewState} from '@/stores/whats-new'

let _emitStartupOnLoadDaemonConnectedOnce = false
let _devicesLoaded = false
let _gitLoaded = false

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
            deviceclone: false, ephemeral: false, favorites: false, featuredBots: true, kbfs: true, kbfsdesktop: !isMobile,
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

export const initSharedSubscriptions = () => {
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

        const updateChat = async () => {
          // On login lets load the untrusted inbox. This helps make some flows easier
          if (useCurrentUserState.getState().username) {
            const {inboxRefresh} = useChatState.getState().dispatch
            inboxRefresh('bootstrap')
          }
          try {
            const rows = await T.RPCGen.configGuiGetValueRpcPromise({path: 'ui.inboxSmallRows'})
            const ri = rows.i ?? -1
            if (ri > 0) {
              useChatState.getState().dispatch.setInboxNumSmallRows(ri, true)
            }
          } catch {}
        }

        getFollowerInfo()
        ignorePromise(updateServerConfig())
        updateTeams()
        updateSettings()
        ignorePromise(updateChat())
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

    if (s.mobileAppState !== old.mobileAppState) {
      if (s.mobileAppState === 'background' && storeRegistry.getState('chat').inboxSearch) {
        storeRegistry.getState('chat').dispatch.toggleInboxSearch(false)
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

    if (s.gregorPushState !== old.gregorPushState) {
      const lastSeenItem = s.gregorPushState.find(i => i.item.category === 'whatsNewLastSeenVersion')
      useWhatsNewState.getState().dispatch.updateLastSeen(lastSeenItem)
    }

    if (s.active !== old.active) {
      const cs = storeRegistry.getConvoState(getSelectedConversation())
      cs.dispatch.markThreadAsRead()
    }
  })

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
          useConfigState.getState().dispatch.loadOnStart('connectedToDaemonForFirstTime')
        }
      }
    }
  })

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
}

// This is to defer loading stores we don't need immediately.
export const _onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifySimpleFSSimpleFSArchiveStatusChanged:
    case EngineGen.chat1NotifyChatChatArchiveComplete:
    case EngineGen.chat1NotifyChatChatArchiveProgress:
      {
        const {useArchiveState} = require('@/stores/archive') as typeof UseArchiveStateType
        useArchiveState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.keybase1NotifyBadgesBadgeState:
      {
        const {useAutoResetState} = require('@/stores/autoreset') as typeof UseAutoResetStateType
        useAutoResetState.getState().dispatch.onEngineIncomingImpl(action)

        const {badgeState} = action.payload.params
        const {newDevices, revokedDevices} = badgeState
        const hasValue = (newDevices?.length ?? 0) + (revokedDevices?.length ?? 0) > 0
        if (_devicesLoaded || hasValue) {
          _devicesLoaded = true
          const {useDevicesState} = require('@/stores/devices') as typeof UseDevicesStateType
          useDevicesState.getState().dispatch.onEngineIncomingImpl(action)
        }

        const badges = new Set(badgeState.newGitRepoGlobalUniqueIDs)
        if (_gitLoaded || badges.size) {
          _gitLoaded = true
          const {useGitState} = require('@/stores/git') as typeof UseGitStateType
          useGitState.getState().dispatch.onEngineIncomingImpl(action)
        }

        const {useNotifState} = require('@/stores/notifications') as typeof UseNotificationsStateType
        useNotifState.getState().dispatch.onEngineIncomingImpl(action)

        const {useTeamsState} = require('@/stores/teams') as typeof UseTeamsStateType
        useTeamsState.getState().dispatch.onEngineIncomingImpl(action)

        const {useChatState} = require('@/stores/chat2') as typeof UseChatStateType
        useChatState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.chat1ChatUiChatShowManageChannels:
    case EngineGen.keybase1NotifyTeamTeamMetadataUpdate:
    case EngineGen.chat1NotifyChatChatWelcomeMessageLoaded:
    case EngineGen.keybase1NotifyTeamTeamTreeMembershipsPartial:
    case EngineGen.keybase1NotifyTeamTeamTreeMembershipsDone:
    case EngineGen.keybase1NotifyTeamTeamRoleMapChanged:
    case EngineGen.keybase1NotifyTeamTeamChangedByID:
    case EngineGen.keybase1NotifyTeamTeamDeleted:
    case EngineGen.keybase1NotifyTeamTeamExit:
    case EngineGen.keybase1GregorUIPushState:
      {
        const {useTeamsState} = require('@/stores/teams') as typeof UseTeamsStateType
        useTeamsState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.keybase1NotifyFeaturedBotsFeaturedBotsUpdate:
      {
        const {useBotsState} = require('@/stores/bots') as typeof UseBotsStateType
        useBotsState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged:
    case EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath:
    case EngineGen.keybase1NotifyFSFSSubscriptionNotify:
      {
        const {useFSState} = require('@/stores/fs') as typeof UseFSStateType
        useFSState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.keybase1NotifyAuditRootAuditError:
    case EngineGen.keybase1NotifyAuditBoxAuditError:
      {
        const {useNotifState} = require('@/stores/notifications') as typeof UseNotificationsStateType
        useNotifState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.keybase1HomeUIHomeUIRefresh:
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
      {
        const {usePeopleState} = require('@/stores/people') as typeof UsePeopleStateType
        usePeopleState.getState().dispatch.onEngineIncomingImpl(action)
        const emailAddress = action.payload.params?.emailAddress
        if (emailAddress) {
          storeRegistry.getState('settings-email').dispatch.notifyEmailVerified(emailAddress)
        }
        const {useSignupState} = require('@/stores/signup') as typeof UseSignupStateType
        useSignupState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.keybase1SecretUiGetPassphrase:
      {
        const {usePinentryState} = require('@/stores/pinentry') as typeof UsePinentryStateType
        usePinentryState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.keybase1NotifyUsersPasswordChanged:
      {
        const randomPW = action.payload.params.state === T.RPCGen.PassphraseState.random
        storeRegistry.getState('settings-password').dispatch.notifyUsersPasswordChanged(randomPW)
      }
      break
    case EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged: {
      const {list} = action.payload.params
      storeRegistry
        .getState('settings-phone')
        .dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined)
      break
    }
    case EngineGen.keybase1NotifyEmailAddressEmailsChanged: {
      const list = action.payload.params.list ?? []
      storeRegistry.getState('settings-email').dispatch.notifyEmailAddressEmailsChanged(list)
      break
    }
    case EngineGen.chat1ChatUiChatInboxFailed:
    case EngineGen.chat1NotifyChatChatSetConvSettings:
    case EngineGen.chat1NotifyChatChatAttachmentUploadStart:
    case EngineGen.chat1NotifyChatChatPromptUnfurl:
    case EngineGen.chat1NotifyChatChatPaymentInfo:
    case EngineGen.chat1NotifyChatChatRequestInfo:
    case EngineGen.chat1NotifyChatChatAttachmentDownloadProgress:
    case EngineGen.chat1NotifyChatChatAttachmentDownloadComplete:
    case EngineGen.chat1NotifyChatChatAttachmentUploadProgress:
    case EngineGen.chat1ChatUiChatCommandMarkdown:
    case EngineGen.chat1ChatUiChatGiphyToggleResultWindow:
    case EngineGen.chat1ChatUiChatCommandStatus:
    case EngineGen.chat1ChatUiChatBotCommandsUpdateStatus:
    case EngineGen.chat1ChatUiChatGiphySearchResults:
    case EngineGen.chat1NotifyChatChatParticipantsInfo:
    case EngineGen.chat1ChatUiChatMaybeMentionUpdate:
    case EngineGen.chat1NotifyChatChatConvUpdate:
    case EngineGen.chat1ChatUiChatCoinFlipStatus:
    case EngineGen.chat1NotifyChatChatThreadsStale:
    case EngineGen.chat1NotifyChatChatSubteamRename:
    case EngineGen.chat1NotifyChatChatTLFFinalize:
    case EngineGen.chat1NotifyChatChatIdentifyUpdate:
    case EngineGen.chat1ChatUiChatInboxUnverified:
    case EngineGen.chat1NotifyChatChatInboxSyncStarted:
    case EngineGen.chat1NotifyChatChatInboxSynced:
    case EngineGen.chat1ChatUiChatInboxLayout:
    case EngineGen.chat1NotifyChatChatInboxStale:
    case EngineGen.chat1ChatUiChatInboxConversation:
    case EngineGen.chat1NotifyChatNewChatActivity:
    case EngineGen.chat1NotifyChatChatTypingUpdate:
    case EngineGen.chat1NotifyChatChatSetConvRetention:
    case EngineGen.chat1NotifyChatChatSetTeamRetention:
      {
        const {useChatState} = require('@/stores/chat2') as typeof UseChatStateType
        useChatState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.keybase1NotifyServiceHandleKeybaseLink:
      {
        const {link, deferred} = action.payload.params
        if (deferred && !link.startsWith('keybase://team-invite-link/')) {
          return
        }
        handleKeybaseLink(link)
      }
      break
    case EngineGen.keybase1NotifyTeamAvatarUpdated: {
      const {name} = action.payload.params
      useAvatarState.getState().dispatch.updated(name)
      break
    }
    case EngineGen.keybase1NotifyTrackingTrackingChanged: {
      const {isTracking, username} = action.payload.params
      useFollowerState.getState().dispatch.updateFollowing(username, isTracking)
      const {useTrackerState} = require('@/stores/tracker2') as typeof UseTracker2StateType
      useTrackerState.getState().dispatch.onEngineIncomingImpl(action)
      break
    }
    case EngineGen.keybase1NotifyTrackingTrackingInfo: {
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
    case EngineGen.keybase1Identify3UiIdentify3Result:
    case EngineGen.keybase1Identify3UiIdentify3ShowTracker:
    case EngineGen.keybase1NotifyUsersUserChanged:
    case EngineGen.keybase1NotifyTrackingNotifyUserBlocked:
    case EngineGen.keybase1Identify3UiIdentify3UpdateRow:
    case EngineGen.keybase1Identify3UiIdentify3UserReset:
    case EngineGen.keybase1Identify3UiIdentify3UpdateUserCard:
    case EngineGen.keybase1Identify3UiIdentify3Summary:
      {
        const {useTrackerState} = require('@/stores/tracker2') as typeof UseTracker2StateType
        useTrackerState.getState().dispatch.onEngineIncomingImpl(action)
      }
      {
        const {useUsersState} = require('@/stores/users') as typeof UseUsersStateType
        useUsersState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.keybase1NotifyUsersIdentifyUpdate:
      {
        const {useUsersState} = require('@/stores/users') as typeof UseUsersStateType
        useUsersState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    case EngineGen.keybase1RekeyUIRefresh:
    case EngineGen.keybase1RekeyUIDelegateRekeyUI:
      {
        const {useUnlockFoldersState} = require('@/stores/unlock-folders') as typeof UseUnlockFoldersStateType
        useUnlockFoldersState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
  useConfigState.getState().dispatch.onEngineIncoming(action)
}
