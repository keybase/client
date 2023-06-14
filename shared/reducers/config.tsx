import logger from '../logger'
import * as Constants from '../constants/config'
import * as ChatConstants from '../constants/chat2'
import * as EngineGen from '../actions/engine-gen-gen'
import * as ProvisionGen from '../actions/provision-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import type * as GregorGen from '../actions/gregor-gen'
import type * as Types from '../constants/types/config'
import type * as Tracker2Gen from '../actions/tracker2-gen'
import {isMobile} from '../constants/platform'

type Actions =
  | ConfigGen.Actions
  | Tracker2Gen.UpdatedDetailsPayload
  | EngineGen.Keybase1NotifyRuntimeStatsRuntimeStatsUpdatePayload
  | EngineGen.Keybase1NotifyTeamAvatarUpdatedPayload
  | GregorGen.PushStatePayload
  | ProvisionGen.StartProvisionPayload

export default Container.makeReducer<Actions, Types.State>(Constants.initialState, {
  [ProvisionGen.startProvision]: draftState => {
    draftState.justRevokedSelf = ''
  },
  [ConfigGen.revoked]: (draftState, action) => {
    const {wasCurrentDevice, deviceName} = action.payload
    // if revoking self find another name if it exists
    if (wasCurrentDevice) {
      draftState.justRevokedSelf = deviceName
    }
  },
  [ConfigGen.resetStore]: draftState => ({
    ...Constants.initialState,
    logoutHandshakeVersion: draftState.logoutHandshakeVersion,
    logoutHandshakeWaiters: draftState.logoutHandshakeWaiters,
    pushLoaded: draftState.pushLoaded,
    startupDetailsLoaded: draftState.startupDetailsLoaded,
    useNativeFrame: draftState.useNativeFrame,
    userSwitching: draftState.userSwitching,
  }),
  [ConfigGen.updateWindowMaxState]: (draftState, action) => {
    draftState.mainWindowMax = action.payload.max
  },
  [ConfigGen.updateWindowShown]: (draftState, action) => {
    const count = draftState.windowShownCount.get(action.payload.component) ?? 0
    draftState.windowShownCount.set(action.payload.component, count + 1)
  },

  [ConfigGen.logoutHandshake]: (draftState, action) => {
    draftState.logoutHandshakeVersion = action.payload.version
    draftState.logoutHandshakeWaiters = new Map()
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
    }
  },
  [ConfigGen.setStartupFile]: (draftState, action) => {
    draftState.startupFile = action.payload.startupFile
  },
  [ConfigGen.pushLoaded]: (draftState, action) => {
    draftState.pushLoaded = action.payload.pushLoaded
  },
  [ConfigGen.bootstrapStatusLoaded]: (draftState, action) => {
    draftState.loggedIn = action.payload.loggedIn
    if (action.payload.loggedIn) {
      draftState.userSwitching = false
    }
  },
  [ConfigGen.loggedIn]: draftState => {
    draftState.loggedIn = true
  },
  [ConfigGen.loggedOut]: draftState => {
    draftState.loggedIn = false
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
  [ConfigGen.setUserSwitching]: (draftState, action) => {
    draftState.userSwitching = action.payload.userSwitching
  },
  [ConfigGen.setDeletedSelf]: (draftState, action) => {
    draftState.justDeletedSelf = action.payload.deletedUsername
  },
  [ConfigGen.daemonHandshakeDone]: draftState => {
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
  [ConfigGen.osNetworkStatusChanged]: (draftState, action) => {
    draftState.osNetworkOnline = action.payload.online
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
  [ConfigGen.setIncomingShareUseOriginal]: (draftState, action) => {
    draftState.incomingShareUseOriginal = action.payload.useOriginal
  },
})
