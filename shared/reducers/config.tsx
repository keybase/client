import logger from '../logger'
import * as Constants from '../constants/config'
import * as ChatConstants from '../constants/chat2'
import * as DevicesGen from '../actions/devices-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as GregorGen from '../actions/gregor-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Stats from '../engine/stats'
import * as Container from '../util/container'
import * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/config'
import type * as Tracker2Gen from '../actions/tracker2-gen'
import {isEOFError, isErrorTransient} from '../util/errors'
import {isMobile} from '../constants/platform'
import {_setSystemIsDarkMode, _setDarkModePreference} from '../styles/dark-mode'
import isEqual from 'lodash/isEqual'

type Actions =
  | ConfigGen.Actions
  | DevicesGen.RevokedPayload
  | Tracker2Gen.UpdatedDetailsPayload
  | EngineGen.Keybase1NotifyTrackingTrackingChangedPayload
  | EngineGen.Keybase1NotifyRuntimeStatsRuntimeStatsUpdatePayload
  | EngineGen.Keybase1NotifyTeamAvatarUpdatedPayload
  | GregorGen.PushStatePayload

export default Container.makeReducer<Actions, Types.State>(Constants.initialState, {
  [DevicesGen.revoked]: (draftState, action) => {
    const {wasCurrentDevice} = action.payload
    // if revoking self find another name if it exists
    if (wasCurrentDevice) {
      const {configuredAccounts, defaultUsername} = draftState
      draftState.defaultUsername = (
        configuredAccounts.find(n => n.username !== defaultUsername) || {
          username: '',
        }
      ).username
    }
  },
  [ConfigGen.resetStore]: draftState => ({
    ...Constants.initialState,
    appFocused: draftState.appFocused,
    appFocusedCount: draftState.appFocusedCount,
    configuredAccounts: draftState.configuredAccounts,
    daemonHandshakeState: draftState.daemonHandshakeState,
    daemonHandshakeVersion: draftState.daemonHandshakeVersion,
    daemonHandshakeWaiters: draftState.daemonHandshakeWaiters,
    darkModePreference: draftState.darkModePreference,
    defaultUsername: draftState.defaultUsername,
    logoutHandshakeVersion: draftState.logoutHandshakeVersion,
    logoutHandshakeWaiters: draftState.logoutHandshakeWaiters,
    menubarWindowID: draftState.menubarWindowID,
    pushLoaded: draftState.pushLoaded,
    startupDetailsLoaded: draftState.startupDetailsLoaded,
    useNativeFrame: draftState.useNativeFrame,
    userSwitching: draftState.userSwitching,
  }),
  [ConfigGen.restartHandshake]: draftState => {
    draftState.daemonError = undefined
    draftState.daemonHandshakeFailedReason = ''
    draftState.daemonHandshakeRetriesLeft = Math.max(draftState.daemonHandshakeRetriesLeft - 1, 0)
    draftState.daemonHandshakeState = 'starting'
  },
  [ConfigGen.startHandshake]: draftState => {
    draftState.daemonError = undefined
    draftState.daemonHandshakeFailedReason = ''
    draftState.daemonHandshakeRetriesLeft = Constants.maxHandshakeTries
    draftState.daemonHandshakeState = 'starting'
  },
  [ConfigGen.logoutHandshake]: (draftState, action) => {
    draftState.logoutHandshakeVersion = action.payload.version
    draftState.logoutHandshakeWaiters = new Map()
  },
  [ConfigGen.daemonHandshake]: (draftState, action) => {
    draftState.daemonHandshakeState = 'waitingForWaiters'
    draftState.daemonHandshakeVersion = action.payload.version
    draftState.daemonHandshakeWaiters = new Map()
  },
  [ConfigGen.daemonHandshakeWait]: (draftState, action) => {
    const {daemonHandshakeState, daemonHandshakeVersion, daemonHandshakeFailedReason} = draftState
    const {version} = action.payload
    if (daemonHandshakeState !== 'waitingForWaiters') {
      throw new Error("Should only get a wait while we're waiting")
    }

    if (version !== daemonHandshakeVersion) {
      logger.info('Ignoring handshake wait due to version mismatch', version, daemonHandshakeVersion)
      return
    }

    const {daemonHandshakeWaiters} = draftState
    const {name, increment, failedFatal, failedReason} = action.payload
    const oldCount = daemonHandshakeWaiters.get(name) || 0
    const newCount = oldCount + (increment ? 1 : -1)
    if (newCount === 0) {
      daemonHandshakeWaiters.delete(name)
    } else {
      daemonHandshakeWaiters.set(name, newCount)
    }

    if (failedFatal) {
      draftState.daemonHandshakeFailedReason = failedReason || ''
      draftState.daemonHandshakeRetriesLeft = 0
    } else {
      // Keep the first error
      if (!daemonHandshakeFailedReason) {
        draftState.daemonHandshakeFailedReason = failedReason || ''
      }
    }
  },
  [ConfigGen.logoutHandshakeWait]: (draftState, action) => {
    const {version} = action.payload
    const {logoutHandshakeVersion} = draftState
    if (version !== logoutHandshakeVersion) {
      logger.info('Ignoring logout handshake due to version mismatch', version, logoutHandshakeVersion)
      return
    }
    const {increment, name} = action.payload
    const {logoutHandshakeWaiters} = draftState
    const oldCount = logoutHandshakeWaiters.get(name) || 0
    const newCount = oldCount + (increment ? 1 : -1)
    if (newCount === 0) {
      logoutHandshakeWaiters.delete(name)
    } else {
      logoutHandshakeWaiters.set(name, newCount)
    }
  },
  [ConfigGen.setStartupDetails]: (draftState, action) => {
    if (!draftState.startupDetailsLoaded) {
      draftState.startupDetailsLoaded = true
      draftState.startupConversation = action.payload.startupConversation || ChatConstants.noConversationIDKey
      draftState.startupPushPayload = action.payload.startupPushPayload
      draftState.startupFollowUser = action.payload.startupFollowUser
      draftState.startupLink = action.payload.startupLink
      draftState.startupTab = action.payload.startupTab
      draftState.startupWasFromPush = action.payload.startupWasFromPush
      if (action.payload.startupSharePath) {
        draftState.androidShare = {
          type: RPCTypes.IncomingShareType.file,
          url: action.payload.startupSharePath,
        }
      } else if (action.payload.startupShareText) {
        draftState.androidShare = {
          text: action.payload.startupShareText,
          type: RPCTypes.IncomingShareType.text,
        }
      }
    }
  },
  [ConfigGen.setStartupFile]: (draftState, action) => {
    draftState.startupFile = action.payload.startupFile
  },
  [ConfigGen.pushLoaded]: (draftState, action) => {
    draftState.pushLoaded = action.payload.pushLoaded
  },
  [ConfigGen.bootstrapStatusLoaded]: (draftState, action) => {
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
  },
  [ConfigGen.followerInfoUpdated]: (draftState, action) => {
    if (draftState.uid === action.payload.uid) {
      const newFollowers = new Set(action.payload.followers)
      if (!isEqual(newFollowers, draftState.followers)) {
        draftState.followers = newFollowers
      }
      const newFollowing = new Set(action.payload.followees)
      if (!isEqual(newFollowing, draftState.following)) {
        draftState.following = newFollowing
      }
    }
  },
  [ConfigGen.loggedIn]: draftState => {
    draftState.loggedIn = true
  },
  [ConfigGen.loggedOut]: draftState => {
    draftState.loggedIn = false
  },
  [EngineGen.keybase1NotifyTrackingTrackingChanged]: (draftState, action) => {
    const {isTracking, username} = action.payload.params
    const {following} = draftState
    if (isTracking) {
      following.add(username)
    } else {
      following.delete(username)
    }
  },
  [ConfigGen.globalError]: (draftState, action) => {
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
  },
  [ConfigGen.daemonError]: (draftState, action) => {
    const {daemonError} = action.payload
    if (daemonError) {
      logger.error('Error (daemon):', daemonError)
    }
    draftState.daemonError = daemonError
  },
  [ConfigGen.changedFocus]: (draftState, action) => {
    draftState.appFocused = action.payload.appFocused
    draftState.appFocusedCount++
  },
  [ConfigGen.changedActive]: (draftState, action) => {
    draftState.userActive = action.payload.userActive
  },
  [ConfigGen.setNotifySound]: (draftState, action) => {
    draftState.notifySound = action.payload.notifySound
  },
  [ConfigGen.setOpenAtLogin]: (draftState, action) => {
    draftState.openAtLogin = action.payload.openAtLogin
  },
  [ConfigGen.updateMenubarWindowID]: (draftState, action) => {
    draftState.menubarWindowID = action.payload.id
  },
  [ConfigGen.setAccounts]: (draftState, action) => {
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
  },
  [ConfigGen.setUserSwitching]: (draftState, action) => {
    draftState.userSwitching = action.payload.userSwitching
  },
  [ConfigGen.setDefaultUsername]: (draftState, action) => {
    draftState.defaultUsername = action.payload.username
  },
  [ConfigGen.setDeletedSelf]: (draftState, action) => {
    draftState.justDeletedSelf = action.payload.deletedUsername
  },
  [ConfigGen.daemonHandshakeDone]: draftState => {
    draftState.daemonHandshakeState = 'done'
    draftState.startupDetailsLoaded = isMobile ? draftState.startupDetailsLoaded : true
  },
  [ConfigGen.updateNow]: draftState => {
    if (draftState.outOfDate) {
      draftState.outOfDate.updating = true
    } else {
      draftState.outOfDate = {
        critical: false,
        updating: true,
      }
    }
  },
  [ConfigGen.updateInfo]: (draftState, action) => {
    draftState.outOfDate = action.payload.isOutOfDate
      ? {
          critical: action.payload.critical,
          message: action.payload.message,
          updating: false,
        }
      : undefined
  },
  [ConfigGen.updateCriticalCheckStatus]: (draftState, action) => {
    draftState.appOutOfDateMessage = action.payload.message
    draftState.appOutOfDateStatus = action.payload.status
  },
  [EngineGen.keybase1NotifyRuntimeStatsRuntimeStatsUpdate]: (draftState, action) => {
    if (!action.payload.params.stats) {
      draftState.runtimeStats = undefined
    } else {
      draftState.runtimeStats = {
        ...draftState.runtimeStats,
        ...action.payload.params.stats,
      } as Types.State['runtimeStats']
    }
  },
  [ConfigGen.updateHTTPSrvInfo]: (draftState, action) => {
    logger.info(
      `config reducer: http server info: addr: ${action.payload.address} token: ${action.payload.token}`
    )
    draftState.httpSrvAddress = action.payload.address
    draftState.httpSrvToken = action.payload.token
  },
  [EngineGen.keybase1NotifyTeamAvatarUpdated]: (draftState, action) => {
    const {name} = action.payload.params
    const {avatarRefreshCounter} = draftState
    avatarRefreshCounter.set(name, (avatarRefreshCounter.get(name) || 0) + 1)
  },
  [ConfigGen.osNetworkStatusChanged]: (draftState, action) => {
    draftState.osNetworkOnline = action.payload.online
  },
  [ConfigGen.setDarkModePreference]: (draftState, action) => {
    _setDarkModePreference(action.payload.preference)
    draftState.darkModePreference = action.payload.preference
  },
  [ConfigGen.setSystemDarkMode]: (draftState, action) => {
    _setSystemIsDarkMode(action.payload.dark)
    draftState.systemDarkMode = action.payload.dark
  },
  [ConfigGen.remoteWindowWantsProps]: (draftState, action) => {
    const {component, param} = action.payload
    const {remoteWindowNeedsProps} = draftState
    const map = remoteWindowNeedsProps.get(component) || new Map()
    remoteWindowNeedsProps.set(component, map)
    map.set(param, (map.get(param) || 0) + 1)
  },
  [ConfigGen.updateWindowState]: (draftState, action) => {
    draftState.windowState = action.payload.windowState
  },
  [ConfigGen.setUseNativeFrame]: (draftState, action) => {
    draftState.useNativeFrame = action.payload.useNativeFrame
  },
  [ConfigGen.setWhatsNewLastSeenVersion]: (draftState, action) => {
    draftState.whatsNewLastSeenVersion = action.payload.lastSeenVersion
  },
  [ConfigGen.loadedOnLoginStartup]: (draftState, action) => {
    draftState.openAtLogin = action.payload.status === true
  },
  [ConfigGen.androidShare]: (draftState, action) => {
    if (action.payload.url) {
      draftState.androidShare = {
        type: RPCTypes.IncomingShareType.file,
        url: action.payload.url,
      }
    } else if (action.payload.text) {
      draftState.androidShare = {
        text: action.payload.text,
        type: RPCTypes.IncomingShareType.text,
      }
    }
  },
  [ConfigGen.setIncomingShareUseOriginal]: (draftState, action) => {
    draftState.incomingShareUseOriginal = action.payload.useOriginal
  },
  [GregorGen.pushState]: (draftState, action) => {
    const items = action.payload.state
    draftState.allowAnimatedEmojis = !items.find(i => i.item && i.item.category === 'emojianimations')
  },
})
