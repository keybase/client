import logger from '../logger'
import * as Types from '../constants/types/config'
import * as Constants from '../constants/config'
import * as ChatConstants from '../constants/chat2'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as DevicesGen from '../actions/devices-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Stats from '../engine/stats'
import * as Container from '../util/container'
import {isEOFError, isErrorTransient} from '../util/errors'
import {isMobile} from '../constants/platform'
import {_setSystemIsDarkMode, _setDarkModePreference} from '../styles/dark-mode'

type Actions =
  | ConfigGen.Actions
  | DevicesGen.RevokedPayload
  | Tracker2Gen.UpdatedDetailsPayload
  | EngineGen.Keybase1NotifyTrackingTrackingChangedPayload
  | EngineGen.Keybase1NotifyRuntimeStatsRuntimeStatsUpdatePayload
  | EngineGen.Keybase1NotifyTeamAvatarUpdatedPayload

export default (state: Types.State = Constants.initialState, action: Actions): Types.State =>
  Container.produce(state, (draftState: Container.Draft<Types.State>) => {
    switch (action.type) {
      case DevicesGen.revoked: {
        // if revoking self find another name if it exists
        if (action.payload.wasCurrentDevice) {
          const {configuredAccounts, defaultUsername} = draftState
          draftState.defaultUsername = (
            configuredAccounts.find(n => n.username !== defaultUsername) || {
              username: '',
            }
          ).username
        }
        return
      }
      case Tracker2Gen.updatedDetails: {
        const followers = new Set(draftState.followers)
        const following = new Set(draftState.following)
        const {username, followThem, followsYou} = action.payload

        if (followThem) {
          following.add(username)
        } else {
          following.delete(username)
        }

        if (followsYou) {
          followers.add(username)
        } else {
          followers.delete(username)
        }
        draftState.followers = followers
        draftState.following = following
        return
      }
      case ConfigGen.resetStore:
        return {
          ...Constants.initialState,
          appFocused: draftState.appFocused,
          appFocusedCount: draftState.appFocusedCount,
          configuredAccounts: draftState.configuredAccounts,
          daemonHandshakeState: draftState.daemonHandshakeState,
          daemonHandshakeVersion: draftState.daemonHandshakeVersion,
          daemonHandshakeWaiters: draftState.daemonHandshakeWaiters,
          defaultUsername: draftState.defaultUsername,
          logoutHandshakeVersion: draftState.logoutHandshakeVersion,
          logoutHandshakeWaiters: draftState.logoutHandshakeWaiters,
          menubarWindowID: draftState.menubarWindowID,
          pushLoaded: draftState.pushLoaded,
          startupDetailsLoaded: draftState.startupDetailsLoaded,
          userSwitching: draftState.userSwitching,
        }
      case ConfigGen.restartHandshake:
        draftState.daemonError = undefined
        draftState.daemonHandshakeFailedReason = ''
        draftState.daemonHandshakeRetriesLeft = Math.max(draftState.daemonHandshakeRetriesLeft - 1, 0)
        draftState.daemonHandshakeState = 'starting'
        return
      case ConfigGen.startHandshake:
        draftState.daemonError = undefined
        draftState.daemonHandshakeFailedReason = ''
        draftState.daemonHandshakeRetriesLeft = Constants.maxHandshakeTries
        draftState.daemonHandshakeState = 'starting'
        return
      case ConfigGen.logoutHandshake:
        draftState.logoutHandshakeVersion = action.payload.version
        draftState.logoutHandshakeWaiters = new Map()
        return
      case ConfigGen.daemonHandshake:
        draftState.daemonHandshakeState = 'waitingForWaiters'
        draftState.daemonHandshakeVersion = action.payload.version
        draftState.daemonHandshakeWaiters = new Map()
        return
      case ConfigGen.daemonHandshakeWait: {
        if (draftState.daemonHandshakeState !== 'waitingForWaiters') {
          throw new Error("Should only get a wait while we're waiting")
        }

        const {version} = action.payload

        if (version !== draftState.daemonHandshakeVersion) {
          logger.info(
            'Ignoring handshake wait due to version mismatch',
            version,
            draftState.daemonHandshakeVersion
          )
          return
        }

        const daemonHandshakeWaiters = new Map(draftState.daemonHandshakeWaiters)
        const {name, increment, failedFatal, failedReason} = action.payload
        const oldCount = daemonHandshakeWaiters.get(name) || 0
        const newCount = oldCount + (increment ? 1 : -1)
        if (newCount === 0) {
          daemonHandshakeWaiters.delete(name)
        } else {
          daemonHandshakeWaiters.set(name, newCount)
        }

        draftState.daemonHandshakeWaiters = daemonHandshakeWaiters
        if (failedFatal) {
          draftState.daemonHandshakeFailedReason = failedReason || ''
          draftState.daemonHandshakeRetriesLeft = 0
          return
        } else {
          // Keep the first error
          if (draftState.daemonHandshakeFailedReason) {
            return
          }
          draftState.daemonHandshakeFailedReason = failedReason || ''
          return
        }
      }
      case ConfigGen.logoutHandshakeWait: {
        const {version} = action.payload
        if (version !== draftState.logoutHandshakeVersion) {
          logger.info(
            'Ignoring logout handshake due to version mismatch',
            version,
            draftState.logoutHandshakeVersion
          )
          return
        }
        const {increment, name} = action.payload
        const oldCount = draftState.logoutHandshakeWaiters.get(action.payload.name) || 0
        const newCount = oldCount + (increment ? 1 : -1)
        const logoutHandshakeWaiters = new Map(draftState.logoutHandshakeWaiters)
        if (newCount === 0) {
          logoutHandshakeWaiters.delete(name)
        } else {
          logoutHandshakeWaiters.set(name, newCount)
        }

        draftState.logoutHandshakeWaiters = logoutHandshakeWaiters
        return
      }
      case ConfigGen.setStartupDetails:
        if (draftState.startupDetailsLoaded) {
          return
        } else {
          draftState.startupConversation =
            action.payload.startupConversation || ChatConstants.noConversationIDKey
          draftState.startupDetailsLoaded = true
          draftState.startupFollowUser = action.payload.startupFollowUser
          draftState.startupLink = action.payload.startupLink
          draftState.startupSharePath = action.payload.startupSharePath
          draftState.startupTab = action.payload.startupTab
          draftState.startupWasFromPush = action.payload.startupWasFromPush
          return
        }
      case ConfigGen.pushLoaded:
        draftState.pushLoaded = action.payload.pushLoaded
        return
      case ConfigGen.bootstrapStatusLoaded:
        // keep it if we're logged out
        draftState.defaultUsername = action.payload.username || draftState.defaultUsername
        draftState.deviceID = action.payload.deviceID
        draftState.deviceName = action.payload.deviceName
        draftState.loggedIn = action.payload.loggedIn
        draftState.registered = action.payload.registered
        draftState.uid = action.payload.uid
        draftState.username = action.payload.username
        if (action.payload.loggedIn) {
          draftState.userSwitching = false
        }
        return
      case ConfigGen.followerInfoUpdated:
        if (draftState.uid === action.payload.uid) {
          draftState.followers = new Set(action.payload.followers)
          draftState.following = new Set(action.payload.followees)
        }
        return
      case ConfigGen.loggedIn:
        draftState.loggedIn = true
        return
      case ConfigGen.loggedOut:
        draftState.loggedIn = false
        return
      case EngineGen.keybase1NotifyTrackingTrackingChanged: {
        const {isTracking, username} = action.payload.params
        const following = new Set(draftState.following)
        if (isTracking) {
          following.add(username)
        } else {
          following.delete(username)
        }
        draftState.following = following
        return
      }
      case ConfigGen.globalError: {
        const {globalError} = action.payload
        if (globalError) {
          logger.error('Error (global):', globalError)
          if (isEOFError(globalError)) {
            Stats.gotEOF()
          }
          if (isErrorTransient(globalError)) {
            logger.info('globalError silencing:', globalError)
            return
          }
        }
        draftState.globalError = globalError
        return
      }
      case ConfigGen.daemonError: {
        const {daemonError} = action.payload
        if (daemonError) {
          logger.error('Error (daemon):', daemonError)
        }
        draftState.daemonError = daemonError
        return
      }
      case ConfigGen.changedFocus:
        draftState.appFocused = action.payload.appFocused
        draftState.appFocusedCount = draftState.appFocusedCount + 1
        return
      case ConfigGen.changedActive:
        draftState.userActive = action.payload.userActive
        return
      case ConfigGen.setNotifySound:
        draftState.notifySound = action.payload.notifySound
        return
      case ConfigGen.setOpenAtLogin:
        draftState.openAtLogin = action.payload.openAtLogin
        return
      case ConfigGen.updateMenubarWindowID:
        draftState.menubarWindowID = action.payload.id
        return
      case ConfigGen.setAccounts: {
        // already have one?
        const {configuredAccounts} = action.payload
        let defaultUsername = draftState.defaultUsername
        const currentFound = configuredAccounts.some(account => account.username === defaultUsername)

        if (!currentFound) {
          const defaultUsernames = configuredAccounts
            .filter(account => account.isCurrent)
            .map(account => account.username)
          defaultUsername = defaultUsernames[0] || ''
        }

        draftState.configuredAccounts = configuredAccounts.map(account => ({
          hasStoredSecret: account.hasStoredSecret,
          username: account.username,
        }))
        draftState.defaultUsername = defaultUsername
        return
      }
      case ConfigGen.setUserSwitching:
        draftState.userSwitching = action.payload.userSwitching
        return
      case ConfigGen.setDefaultUsername:
        draftState.defaultUsername = action.payload.username
        return
      case ConfigGen.setDeletedSelf:
        draftState.justDeletedSelf = action.payload.deletedUsername
        return
      case ConfigGen.daemonHandshakeDone:
        draftState.daemonHandshakeState = 'done'
        draftState.startupDetailsLoaded = isMobile ? draftState.startupDetailsLoaded : true
        return
      case ConfigGen.updateNow:
        if (draftState.outOfDate) {
          draftState.outOfDate.updating = true
        } else {
          draftState.outOfDate = {
            critical: false,
            updating: true,
          }
        }
        return
      case ConfigGen.updateInfo:
        draftState.outOfDate = action.payload.isOutOfDate
          ? {
              critical: action.payload.critical,
              message: action.payload.message,
              updating: false,
            }
          : undefined
        return
      case ConfigGen.updateCriticalCheckStatus:
        draftState.appOutOfDateMessage = action.payload.message
        draftState.appOutOfDateStatus = action.payload.status
        return
      case EngineGen.keybase1NotifyRuntimeStatsRuntimeStatsUpdate:
        draftState.runtimeStats = {
          ...draftState.runtimeStats,
          ...action.payload.params.stats,
        } as Types.State['runtimeStats']
        return
      case ConfigGen.updateHTTPSrvInfo:
        draftState.httpSrvAddress = action.payload.address
        draftState.httpSrvToken = action.payload.token
        return
      case EngineGen.keybase1NotifyTeamAvatarUpdated: {
        const {name} = action.payload.params
        const avatarRefreshCounter = new Map(draftState.avatarRefreshCounter)
        avatarRefreshCounter.set(name, (avatarRefreshCounter.get(name) || 0) + 1)
        draftState.avatarRefreshCounter = avatarRefreshCounter
        return
      }
      case ConfigGen.osNetworkStatusChanged:
        draftState.osNetworkOnline = action.payload.online
        return
      case ConfigGen.setDarkModePreference:
        _setDarkModePreference(action.payload.preference)
        draftState.darkModePreference = action.payload.preference
        return
      case ConfigGen.setSystemDarkMode:
        _setSystemIsDarkMode(action.payload.dark)
        draftState.systemDarkMode = action.payload.dark
        return
      case ConfigGen.remoteWindowWantsProps: {
        const {component, param} = action.payload
        const remoteWindowNeedsProps = new Map(draftState.remoteWindowNeedsProps)
        const oldMap = remoteWindowNeedsProps.get(component)
        const newMap = oldMap ? new Map(oldMap) : new Map()
        newMap.set(param, (newMap.get(param) || 0) + 1)
        remoteWindowNeedsProps.set(component, newMap)
        draftState.remoteWindowNeedsProps = remoteWindowNeedsProps
        return
      }
      case ConfigGen.updateWindowState:
        draftState.windowState = action.payload.windowState
        return
      case ConfigGen.setUseNativeFrame:
        draftState.useNativeFrame = action.payload.useNativeFrame
        return
      case ConfigGen.setWhatsNewLastSeenVersion:
        draftState.whatsNewLastSeenVersion = action.payload.lastSeenVersion
        return
      case ConfigGen.loadedNixOnLoginStartup:
        draftState.openAtLogin = action.payload.status === true
        return
      // Saga only actions
      case ConfigGen.dumpLogs:
      case ConfigGen.logout:
      case ConfigGen.mobileAppState:
      case ConfigGen.openAppSettings:
      case ConfigGen.showMain:
      case ConfigGen.installerRan:
      case ConfigGen.copyToClipboard:
      case ConfigGen.checkForUpdate:
      case ConfigGen.filePickerError:
      case ConfigGen.persistRoute:
      case ConfigGen.openAppStore:
      case ConfigGen.setNavigator:
      case ConfigGen.logoutAndTryToLogInAs:
      case ConfigGen.loadNixOnLoginStartup:
        return
    }
  })
