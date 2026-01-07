import type * as EngineGen from '@/actions/engine-gen-gen'
import logger from '@/logger'
import {serverConfigFileName} from '../platform'
import * as T from '../types'
import {ignorePromise} from '../utils'
import * as ArchiveUtil from '../archive/util'
import * as AutoResetUtil from '../autoreset/util'
import * as AvatarUtil from '@/common-adapters/avatar/util'
import * as BotsUtil from '../bots/util'
import {useChatState} from '../chat2'
import * as ChatUtil from '../chat2/util'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
import {useDaemonState} from '../daemon'
import {useDarkModeState} from '../darkmode'
import * as DeepLinksUtil from '../deeplinks/util'
import * as DevicesUtil from '../devices/util'
import * as FollowerUtil from '../followers/util'
import * as FSUtil from '../fs/util'
import * as GitUtil from '../git/util'
import * as NotifUtil from '../notifications/util'
import * as PeopleUtil from '../people/util'
import * as PinentryUtil from '../pinentry/util'
import {useProvisionState} from '../provision'
import {storeRegistry} from '../store-registry'
import {useSettingsContactsState} from '../settings-contacts'
import * as SettingsUtil from '../settings/util'
import * as SignupUtil from '../signup/util'
import {useTeamsState} from '../teams'
import * as TeamsUtil from '../teams/util'
import * as TrackerUtil from '../tracker2/util'
import * as UnlockFoldersUtil from '../unlock-folders/util'
import * as UsersUtil from '../users/util'
import {useWhatsNewState} from '../whats-new'

let _emitStartupOnLoadDaemonConnectedOnce = false

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
          storeRegistry.getState('config').dispatch.refreshAccounts
        )
      if (!s.loggedInCausedbyStartup) {
        ignorePromise(storeRegistry.getState('config').dispatch.refreshAccounts())
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
          storeRegistry.getState('config').dispatch.refreshAccounts
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
  })

  useDaemonState.subscribe((s, old) => {
    if (s.handshakeVersion !== old.handshakeVersion) {
      useDarkModeState.getState().dispatch.loadDarkPrefs()
      storeRegistry.getState('chat').dispatch.loadStaticConfig()
      const configState = storeRegistry.getState('config')
      s.dispatch.loadDaemonAccounts(
        configState.configuredAccounts.length,
        configState.loggedIn,
        storeRegistry.getState('config').dispatch.refreshAccounts
      )
    }

    if (s.bootstrapStatus !== old.bootstrapStatus) {
      const bootstrap = s.bootstrapStatus
      if (bootstrap) {
        const {deviceID, deviceName, loggedIn, uid, username, userReacjis} = bootstrap
        useCurrentUserState.getState().dispatch.setBootstrap({deviceID, deviceName, uid, username})

        const configDispatch = storeRegistry.getState('config').dispatch
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
          storeRegistry.getState('config').dispatch.loadOnStart('connectedToDaemonForFirstTime')
        }
      }
    }
  })

  useProvisionState.subscribe((s, old) => {
    if (s.startProvisionTrigger !== old.startProvisionTrigger) {
      storeRegistry.getState('config').dispatch.setLoginError()
      storeRegistry.getState('config').dispatch.resetRevokedSelf()
      const f = async () => {
        // If we're logged in, we're coming from the user switcher; log out first to prevent the service from getting out of sync with the GUI about our logged-in-ness
        if (storeRegistry.getState('config').loggedIn) {
          await T.RPCGen.loginLogoutRpcPromise(
            {force: false, keepSecrets: true},
            'config:loginAsOther'
          )
        }
      }
      ignorePromise(f())
    }
  })
}

export const onEngineIncoming = (action: EngineGen.Actions) => {
  ArchiveUtil.onEngineIncoming(action)
  AutoResetUtil.onEngineIncoming(action)
  AvatarUtil.onEngineIncoming(action)
  BotsUtil.onEngineIncoming(action)
  ChatUtil.onEngineIncoming(action)
  storeRegistry.getState('config').dispatch.dynamic.onEngineIncomingDesktop?.(action)
  storeRegistry.getState('config').dispatch.dynamic.onEngineIncomingNative?.(action)
  storeRegistry.getState('config').dispatch.onEngineIncoming(action)
  DeepLinksUtil.onEngineIncoming(action)
  DevicesUtil.onEngineIncoming(action)
  FollowerUtil.onEngineIncoming(action)
  FSUtil.onEngineIncoming(action)
  GitUtil.onEngineIncoming(action)
  NotifUtil.onEngineIncoming(action)
  PeopleUtil.onEngineIncoming(action)
  PinentryUtil.onEngineIncoming(action)
  SettingsUtil.onEngineIncoming(action)
  SignupUtil.onEngineIncoming(action)
  TeamsUtil.onEngineIncoming(action)
  TrackerUtil.onEngineIncoming(action)
  UnlockFoldersUtil.onEngineIncoming(action)
  UsersUtil.onEngineIncoming(action)
}
