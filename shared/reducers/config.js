// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as Types from '../constants/types/config'
import * as Constants from '../constants/config'
import * as ChatConstants from '../constants/chat2'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as DevicesGen from '../actions/devices-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Stats from '../engine/stats'
import {isEOFError, isErrorTransient} from '../util/errors'
import * as Flow from '../util/flow'
import {isMobile} from '../constants/platform'

const initialState = Constants.makeState()

type Actions =
  | ConfigGen.Actions
  | DevicesGen.RevokedPayload
  | Tracker2Gen.UpdatedDetailsPayload
  | EngineGen.Keybase1NotifyTrackingTrackingChangedPayload

export default function(state: Types.State = initialState, action: Actions): Types.State {
  switch (action.type) {
    case DevicesGen.revoked:
      return state.merge({
        configuredAccounts: state.configuredAccounts,
        defaultUsername: action.payload.wasCurrentDevice // if revoking self find another name if it exists
          ? state.configuredAccounts.find(n => n !== state.defaultUsername) || ''
          : state.defaultUsername,
      })
    case Tracker2Gen.updatedDetails: {
      let followers = state.followers
      let following = state.following
      const {username} = action.payload

      if (action.payload.followThem) {
        following = following.add(username)
      } else {
        following = following.delete(username)
      }

      if (action.payload.followsYou) {
        followers = followers.add(username)
      } else {
        followers = followers.delete(username)
      }
      return state.merge({followers, following})
    }
    case ConfigGen.resetStore:
      return initialState.merge({
        appFocused: state.appFocused,
        appFocusedCount: state.appFocusedCount,
        configuredAccounts: state.configuredAccounts,
        daemonHandshakeState: state.daemonHandshakeState,
        daemonHandshakeVersion: state.daemonHandshakeVersion,
        daemonHandshakeWaiters: state.daemonHandshakeWaiters,
        defaultUsername: state.defaultUsername,
        logoutHandshakeVersion: state.logoutHandshakeVersion,
        logoutHandshakeWaiters: state.logoutHandshakeWaiters,
        menubarWindowID: state.menubarWindowID,
        pushLoaded: state.pushLoaded,
        startupDetailsLoaded: state.startupDetailsLoaded,
      })
    case ConfigGen.restartHandshake:
      return state.merge({
        daemonError: null,
        daemonHandshakeFailedReason: '',
        daemonHandshakeRetriesLeft: Math.max(state.daemonHandshakeRetriesLeft - 1, 0),
        daemonHandshakeState: 'starting',
      })
    case ConfigGen.startHandshake:
      return state.merge({
        daemonError: null,
        daemonHandshakeFailedReason: '',
        daemonHandshakeRetriesLeft: Constants.maxHandshakeTries,
        daemonHandshakeState: 'starting',
      })
    case ConfigGen.logoutHandshake:
      return state.merge({
        logoutHandshakeVersion: action.payload.version,
        logoutHandshakeWaiters: I.Map(),
      })
    case ConfigGen.daemonHandshake:
      return state.merge({
        daemonHandshakeState: 'waitingForWaiters',
        daemonHandshakeVersion: action.payload.version,
        daemonHandshakeWaiters: I.Map(),
      })
    case ConfigGen.daemonHandshakeWait: {
      if (state.daemonHandshakeState !== 'waitingForWaiters') {
        throw new Error("Should only get a wait while we're waiting")
      }

      if (action.payload.version !== state.daemonHandshakeVersion) {
        logger.info(
          'Ignoring handshake wait due to version mismatch',
          action.payload.version,
          state.daemonHandshakeVersion
        )
        return state
      }

      const oldCount = state.daemonHandshakeWaiters.get(action.payload.name, 0)
      const newCount = oldCount + (action.payload.increment ? 1 : -1)
      const newState =
        newCount === 0
          ? state.deleteIn(['daemonHandshakeWaiters', action.payload.name])
          : state.setIn(['daemonHandshakeWaiters', action.payload.name], newCount)

      if (action.payload.failedFatal) {
        return newState.merge({
          daemonHandshakeFailedReason: action.payload.failedReason || '',
          daemonHandshakeRetriesLeft: 0,
        })
      } else {
        // Keep the first error
        if (state.daemonHandshakeFailedReason) {
          return newState
        }
        return newState.set('daemonHandshakeFailedReason', action.payload.failedReason || '')
      }
    }
    case ConfigGen.logoutHandshakeWait: {
      if (action.payload.version !== state.logoutHandshakeVersion) {
        logger.info(
          'Ignoring logout handshake due to version mismatch',
          action.payload.version,
          state.logoutHandshakeVersion
        )
        return state
      }
      const oldCount = state.logoutHandshakeWaiters.get(action.payload.name, 0)
      const newCount = oldCount + (action.payload.increment ? 1 : -1)
      return newCount === 0
        ? state.deleteIn(['logoutHandshakeWaiters', action.payload.name])
        : state.setIn(['logoutHandshakeWaiters', action.payload.name], newCount)
    }
    case ConfigGen.setStartupDetails:
      return state.startupDetailsLoaded
        ? state
        : state.merge({
            startupConversation: action.payload.startupConversation || ChatConstants.noConversationIDKey,
            startupDetailsLoaded: true,
            startupFollowUser: action.payload.startupFollowUser,
            startupLink: action.payload.startupLink,
            startupTab: action.payload.startupTab,
            startupWasFromPush: action.payload.startupWasFromPush,
          })
    case ConfigGen.pushLoaded:
      return state.merge({pushLoaded: action.payload.pushLoaded})
    case ConfigGen.bootstrapStatusLoaded:
      return state.merge({
        // keep it if we're logged out
        defaultUsername: action.payload.username || state.defaultUsername,
        deviceID: action.payload.deviceID,
        deviceName: action.payload.deviceName,
        followers: I.Set(action.payload.followers),
        following: I.Set(action.payload.following),
        loggedIn: action.payload.loggedIn,
        registered: action.payload.registered,
        uid: action.payload.uid,
        username: action.payload.username,
      })
    case ConfigGen.loggedIn:
      return state.merge({loggedIn: true})
    case ConfigGen.loggedOut:
      return state.merge({loggedIn: false})
    case EngineGen.keybase1NotifyTrackingTrackingChanged: {
      const {isTracking, username} = action.payload.params
      return state.updateIn(['following'], following =>
        isTracking ? following.add(username) : following.delete(username)
      )
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
          return state
        }
      }
      return state.merge({globalError})
    }
    case ConfigGen.daemonError: {
      const {daemonError} = action.payload
      if (daemonError) {
        logger.error('Error (daemon):', daemonError)
      }
      return state.merge({daemonError})
    }
    case ConfigGen.changedFocus:
      return state.merge({
        appFocused: action.payload.appFocused,
        appFocusedCount: state.appFocusedCount + 1,
      })
    case ConfigGen.changedActive:
      return state.merge({userActive: action.payload.userActive})
    case ConfigGen.loadedAvatars:
      return state.merge({avatars: state.avatars.merge(action.payload.avatars)})
    case ConfigGen.setNotifySound:
      return state.merge({notifySound: action.payload.sound})
    case ConfigGen.setOpenAtLogin:
      return state.merge({openAtLogin: action.payload.open})
    case ConfigGen.updateMenubarWindowID:
      return state.merge({menubarWindowID: action.payload.id})
    case ConfigGen.setAccounts:
      // already have one?
      let defaultUsername = state.defaultUsername
      if (action.payload.usernames.indexOf(defaultUsername) === -1) {
        defaultUsername = action.payload.defaultUsername
      }

      return state.merge({
        configuredAccounts: I.List(action.payload.usernames),
        defaultUsername,
      })
    case ConfigGen.setDeletedSelf:
      return state.merge({justDeletedSelf: action.payload.deletedUsername})
    case ConfigGen.swapRouter: {
      return state.set('useNewRouter', action.payload.useNewRouter)
    }
    case ConfigGen.daemonHandshakeDone:
      return state.merge({
        daemonHandshakeState: 'done',
        startupDetailsLoaded: isMobile ? state.startupDetailsLoaded : true,
      })
    case ConfigGen.updateNow:
      return state.update('outOfDate', outOfDate => outOfDate && outOfDate.set('updating', true))
    case ConfigGen.updateInfo:
      return state.set(
        'outOfDate',
        action.payload.isOutOfDate
          ? Constants.makeOutOfDate({
              critical: action.payload.critical,
              message: action.payload.message,
            })
          : null
      )
    // Saga only actions
    case ConfigGen.loadTeamAvatars:
    case ConfigGen.loadAvatars:
    case ConfigGen.dumpLogs:
    case ConfigGen.logout:
    case ConfigGen.link:
    case ConfigGen.mobileAppState:
    case ConfigGen.openAppSettings:
    case ConfigGen.showMain:
    case ConfigGen.setupEngineListeners:
    case ConfigGen.installerRan:
    case ConfigGen.copyToClipboard:
    case ConfigGen.checkForUpdate:
    case ConfigGen.filePickerError:
    case ConfigGen.persistRoute:
    case ConfigGen.setNavigator:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
