import * as EngineGen from '@/actions/engine-gen-gen'
import * as T from '../types'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import * as Tabs from '@/constants/tabs'
import type * as UseArchiveStateType from '@/stores/archive'
import type * as UseAutoResetStateType from '@/stores/autoreset'
import type * as UseBotsStateType from '@/stores/bots'
import type * as UseChatStateType from '@/stores/chat2'
import type * as UseDevicesStateType from '@/stores/devices'
import type * as UseFSStateType from '@/stores/fs'
import type * as UseGitStateType from '@/stores/git'
import type * as UseNotificationsStateType from '@/stores/notifications'
import type * as UsePeopleStateType from '@/stores/people'
import type * as UsePinentryStateType from '@/stores/pinentry'
import type * as UseSettingsPasswordStateType from '@/stores/settings-password'
import type * as UseSignupStateType from '@/stores/signup'
import type * as UseTeamsStateType from '@/stores/teams'
import type * as UseTracker2StateType from '@/stores/tracker2'
import type * as UseUnlockFoldersStateType from '@/stores/unlock-folders'
import type * as UseUsersStateType from '@/stores/users'
import {createTBStore, getTBStore} from '@/stores/team-building'
import {getSelectedConversation} from '@/constants/chat2/common'
import {handleKeybaseLink} from '@/constants/deeplinks'
import {ignorePromise} from '../utils'
import {isMobile, serverConfigFileName} from '../platform'
import {storeRegistry} from '@/stores/store-registry'
import {useAutoResetState} from '@/stores/autoreset'
import {useAvatarState} from '@/common-adapters/avatar/store'
import {useChatState} from '@/stores/chat2'
import {useConfigState} from '@/stores/config'
import {useCryptoState} from '@/stores/crypto'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {useFSState} from '@/stores/fs'
import {useFollowerState} from '@/stores/followers'
import {useNotifState} from '@/stores/notifications'
import {useProfileState} from '@/stores/profile'
import {useProvisionState} from '@/stores/provision'
import {usePushState} from '@/stores/push'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSettingsState} from '@/stores/settings'
import {useSignupState} from '@/stores/signup'
import {useState as useRecoverPasswordState} from '@/stores/recover-password'
import {useTeamsState} from '@/stores/teams'
import {useTrackerState} from '@/stores/tracker2'
import {useUsersState} from '@/stores/users'
import {useWhatsNewState} from '@/stores/whats-new'
import {useRouterState} from '@/stores/router2'
import * as Util from '@/constants/router2'
import {setConvoDefer} from '@/stores/convostate'

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

// Initialize team building callbacks. Not ideal but keeping all the existing logic for now.
export const initTeamBuildingCallbacks = () => {
  const commonCallbacks = {
    onAddMembersWizardPushMembers: (members: Array<T.Teams.AddingMember>) => {
      useTeamsState.getState().dispatch.addMembersWizardPushMembers(members)
    },
    onGetSettingsContactsImportEnabled: () => {
      return useSettingsContactsState.getState().importEnabled
    },
    onGetSettingsContactsUserCountryCode: () => {
      return useSettingsContactsState.getState().userCountryCode
    },
    onShowUserProfile: (username: string) => {
      useProfileState.getState().dispatch.showUserProfile(username)
    },
    onUsersGetBlockState: (usernames: ReadonlyArray<string>) => {
      useUsersState.getState().dispatch.getBlockState(usernames)
    },
    onUsersUpdates: (infos: ReadonlyArray<{name: string; info: Partial<T.Users.UserInfo>}>) => {
      useUsersState.getState().dispatch.updates(infos)
    },
  }

  const namespaces: Array<T.TB.AllowedNamespace> = ['chat2', 'crypto', 'teams', 'people']
  for (const namespace of namespaces) {
    const store = createTBStore(namespace)
    const currentState = store.getState()
    store.setState({
      dispatch: {
        ...currentState.dispatch,
        defer: {
          ...currentState.dispatch.defer,
          ...commonCallbacks,
          ...(namespace === 'chat2'
            ? {
                onFinishedTeamBuildingChat: users => {
                  storeRegistry.getState('chat').dispatch.onTeamBuildingFinished(users)
                },
              }
            : {}),
          ...(namespace === 'crypto'
            ? {
                onFinishedTeamBuildingCrypto: users => {
                  useCryptoState.getState().dispatch.onTeamBuildingFinished(users)
                },
              }
            : {}),
        },
      },
    })
  }
}

export const initAutoResetCallbacks = () => {
  const currentState = useAutoResetState.getState()
  useAutoResetState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        onGetRecoverPasswordUsername: () => {
          return storeRegistry.getState('recover-password').username
        },
        onStartProvision: (username: string, fromReset: boolean) => {
          storeRegistry.getState('provision').dispatch.startProvision(username, fromReset)
        },
      },
    },
  })
}

export const initChat2Callbacks = () => {
  const currentState = useChatState.getState()
  useChatState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        onGetDaemonState: () => {
          const daemonState = storeRegistry.getState('daemon')
          return {dispatch: daemonState.dispatch, handshakeVersion: daemonState.handshakeVersion}
        },
        onGetTeamsTeamIDToMembers: (teamID: T.Teams.TeamID) => {
          return storeRegistry.getState('teams').teamIDToMembers.get(teamID)
        },
        onGetUsersInfoMap: () => {
          return storeRegistry.getState('users').infoMap
        },
        onTeamsGetMembers: (teamID: T.Teams.TeamID) => {
          storeRegistry.getState('teams').dispatch.getMembers(teamID)
        },
        onTeamsUpdateTeamRetentionPolicy: (metas: ReadonlyArray<T.Chat.ConversationMeta>) => {
          storeRegistry.getState('teams').dispatch.updateTeamRetentionPolicy(metas)
        },
        onUsersUpdates: (updates: ReadonlyArray<{name: string; info: Partial<T.Users.UserInfo>}>) => {
          storeRegistry.getState('users').dispatch.updates(updates)
        },
      },
    },
  })
}

export const initTeamsCallbacks = () => {
  const currentState = useTeamsState.getState()
  useTeamsState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        ...currentState.dispatch.defer,
        onChatNavigateToInbox: (allowSwitchTab?: boolean) => {
          storeRegistry.getState('chat').dispatch.navigateToInbox(allowSwitchTab)
        },
        onChatPreviewConversation: (
          p: Parameters<ReturnType<typeof useChatState.getState>['dispatch']['previewConversation']>[0]
        ) => {
          storeRegistry.getState('chat').dispatch.previewConversation(p)
        },
        onUsersUpdates: (updates: ReadonlyArray<{name: string; info: Partial<T.Users.UserInfo>}>) => {
          storeRegistry.getState('users').dispatch.updates(updates)
        },
      },
    },
  })
}

export const initFSCallbacks = () => {
  const currentState = useFSState.getState()
  useFSState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        ...currentState.dispatch.defer,
        onBadgeApp: (key: 'kbfsUploading' | 'outOfSpace', on: boolean) => {
          useNotifState.getState().dispatch.badgeApp(key, on)
        },
        onSetBadgeCounts: (counts: Map<Tabs.Tab, number>) => {
          useNotifState.getState().dispatch.setBadgeCounts(counts)
        },
      },
    },
  })
}

export const initNotificationsCallbacks = () => {
  const currentState = useNotifState.getState()
  useNotifState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        ...currentState.dispatch.defer,
        onFavoritesLoad: () => {
          useFSState.getState().dispatch.favoritesLoad()
        },
      },
    },
  })
}

export const initProfileCallbacks = () => {
  const currentState = useProfileState.getState()
  useProfileState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        ...currentState.dispatch.defer,
        onTracker2GetDetails: (username: string) => {
          return useTrackerState.getState().getDetails(username)
        },
        onTracker2Load: (
          params: Parameters<ReturnType<typeof useTrackerState.getState>['dispatch']['load']>[0]
        ) => {
          useTrackerState.getState().dispatch.load(params)
        },
        onTracker2ShowUser: (username: string, asTracker: boolean, skipNav?: boolean) => {
          useTrackerState.getState().dispatch.showUser(username, asTracker, skipNav)
        },
        onTracker2UpdateResult: (guiID: string, result: T.Tracker.DetailsState, reason?: string) => {
          useTrackerState.getState().dispatch.updateResult(guiID, result, reason)
        },
      },
    },
  })
}

export const initPushCallbacks = () => {
  const currentState = usePushState.getState()
  usePushState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        ...currentState.dispatch.defer,
        onGetDaemonHandshakeState: () => {
          return useDaemonState.getState().handshakeState
        },
        onNavigateToThread: (
          conversationIDKey: T.Chat.ConversationIDKey,
          reason: 'push' | 'extension',
          pushBody?: string
        ) => {
          storeRegistry
            .getConvoState(conversationIDKey)
            .dispatch.navigateToThread(reason, undefined, pushBody)
        },
        onShowUserProfile: (username: string) => {
          useProfileState.getState().dispatch.showUserProfile(username)
        },
      },
    },
  })
}

export const initRecoverPasswordCallbacks = () => {
  const currentState = useRecoverPasswordState.getState()
  useRecoverPasswordState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        ...currentState.dispatch.defer,
        onProvisionCancel: (ignoreWarning?: boolean) => {
          useProvisionState.getState().dispatch.dynamic.cancel?.(ignoreWarning)
        },
        onStartAccountReset: (skipPassword: boolean, username: string) => {
          useAutoResetState.getState().dispatch.startAccountReset(skipPassword, username)
        },
      },
    },
  })
}

export const initSignupCallbacks = () => {
  const currentState = useSignupState.getState()
  useSignupState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        ...currentState.dispatch.defer,
        onEditEmail: (p: {email: string; makeSearchable: boolean}) => {
          useSettingsEmailState.getState().dispatch.editEmail(p)
        },
        onShowPermissionsPrompt: (p: {justSignedUp?: boolean}) => {
          usePushState.getState().dispatch.showPermissionsPrompt(p)
        },
      },
    },
  })
}

export const initTracker2Callbacks = () => {
  const currentState = useTrackerState.getState()
  useTrackerState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        ...currentState.dispatch.defer,
        onShowUserProfile: (username: string) => {
          useProfileState.getState().dispatch.showUserProfile(username)
        },
        onUsersUpdates: (updates: ReadonlyArray<{name: string; info: Partial<T.Users.UserInfo>}>) => {
          useUsersState.getState().dispatch.updates(updates)
        },
      },
    },
  })
}

export const initSettingsCallbacks = () => {
  const currentState = useSettingsState.getState()
  useSettingsState.setState({
    dispatch: {
      ...currentState.dispatch,
      defer: {
        ...currentState.dispatch.defer,
        getSettingsPhonePhones: () => {
          return useSettingsPhoneState.getState().phones
        },
        onSettingsEmailNotifyEmailsChanged: (emails: ReadonlyArray<T.RPCChat.Keybase1.Email>) => {
          useSettingsEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(emails)
        },
        onSettingsPhoneSetNumbers: (phoneNumbers?: ReadonlyArray<T.RPCChat.Keybase1.UserPhoneNumber>) => {
          useSettingsPhoneState.getState().dispatch.setNumbers(phoneNumbers)
        },
      },
    },
  })
}

export const initSharedSubscriptions = () => {
  setConvoDefer({
    chatBlockButtonsMapHas: teamID =>
      storeRegistry.getState('chat').blockButtonsMap.has(teamID),
    chatInboxLayoutSmallTeamsFirstConvID: () =>
      storeRegistry.getState('chat').inboxLayout?.smallTeams?.[0]?.convID,
    chatInboxRefresh: reason =>
      storeRegistry.getState('chat').dispatch.inboxRefresh(reason),
    chatMetasReceived: metas =>
      storeRegistry.getState('chat').dispatch.metasReceived(metas),
    chatNavigateToInbox: () =>
      storeRegistry.getState('chat').dispatch.navigateToInbox(),
    chatPaymentInfoReceived: (_messageID, paymentInfo) =>
      storeRegistry.getState('chat').dispatch.paymentInfoReceived(paymentInfo),
    chatPreviewConversation: p =>
      storeRegistry.getState('chat').dispatch.previewConversation(p),
    chatResetConversationErrored: () =>
      storeRegistry.getState('chat').dispatch.resetConversationErrored(),
    chatUnboxRows: (convIDs, force) =>
      storeRegistry.getState('chat').dispatch.unboxRows(convIDs, force),
    chatUpdateInfoPanel: (show, tab) =>
      storeRegistry.getState('chat').dispatch.updateInfoPanel(show, tab),
    teamsGetMembers: teamID =>
      storeRegistry.getState('teams').dispatch.getMembers(teamID),
    usersGetBio: username =>
      storeRegistry.getState('users').dispatch.getBio(username),
  })
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

  useRouterState.subscribe((s, old) => {
    const next = s.navState as Util.NavState
    const prev = old.navState as Util.NavState
    if (prev === next) return

    const namespaces = ['chat2', 'crypto', 'teams', 'people'] as const
    const namespaceToRoute = new Map([
      ['chat2', 'chatNewChat'],
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
    if (
      prev &&
      Util.getTab(prev) === Tabs.peopleTab &&
      next &&
      Util.getTab(next) !== Tabs.peopleTab &&
      storeRegistry.getState('signup').justSignedUpEmail
    ) {
      storeRegistry.getState('signup').dispatch.clearJustSignedUpEmail()
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

  initAutoResetCallbacks()
  initChat2Callbacks()
  initTeamBuildingCallbacks()
  initTeamsCallbacks()
  initFSCallbacks()
  initNotificationsCallbacks()
  initProfileCallbacks()
  initPushCallbacks()
  initRecoverPasswordCallbacks()
  initSettingsCallbacks()
  initSignupCallbacks()
  initTracker2Callbacks()
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
        const {usePWState} = require('@/stores/settings-password') as typeof UseSettingsPasswordStateType
        usePWState.getState().dispatch.notifyUsersPasswordChanged(randomPW)
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
