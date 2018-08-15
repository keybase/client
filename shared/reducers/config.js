// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as Types from '../constants/types/config'
import * as Constants from '../constants/config'
import * as ChatConstants from '../constants/chat2'
import * as ConfigGen from '../actions/config-gen'

const initialState = Constants.makeState()

export default function(
  state: Types.State = initialState,
  action: ConfigGen.Actions | {type: 'remote:updateMenubarWindowID', payload: {id: number}}
): Types.State {
  switch (action.type) {
    case ConfigGen.resetStore:
      return initialState.merge({
        appFocused: state.appFocused,
        appFocusedCount: state.appFocusedCount,
        configuredAccounts: state.configuredAccounts,
        daemonHandshakeState: state.daemonHandshakeState,
        daemonHandshakeWaiters: state.daemonHandshakeWaiters,
        defaultUsername: state.defaultUsername,
        logoutHandshakeWaiters: state.logoutHandshakeWaiters,
        menubarWindowID: state.menubarWindowID,
        pushLoaded: state.pushLoaded,
        startupDetailsLoaded: state.startupDetailsLoaded,
      })
    // keep current user as default before we make the service call
    case ConfigGen.logout:
      return state.merge({
        defaultUsername: state.username || state.defaultUsername,
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
      return state.merge({logoutHandshakeWaiters: I.Map()})
    case ConfigGen.daemonHandshake:
      return state.merge({daemonHandshakeState: 'waitingForWaiters'})
    case ConfigGen.daemonHandshakeWait: {
      if (state.daemonHandshakeState !== 'waitingForWaiters') {
        throw new Error("Should only get a wait while we're waiting")
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
        return newState.merge({daemonHandshakeFailedReason: action.payload.failedReason || ''})
      }
    }
    case ConfigGen.logoutHandshakeWait: {
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
    case ConfigGen.updateFollowing: {
      const {isTracking, username} = action.payload
      return state.updateIn(
        ['following'],
        following => (isTracking ? following.add(username) : following.delete(username))
      )
    }
    case ConfigGen.globalError: {
      const {globalError} = action.payload
      if (globalError) {
        logger.error('Error (global):', globalError)
      }
      return state.merge({globalError})
    }
    case ConfigGen.debugDump:
      return state.merge({debugDump: action.payload.items})
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
    case ConfigGen.loadedAvatars: {
      const {nameToUrlMap} = action.payload
      return state.merge({
        avatars: {
          ...state.avatars,
          ...nameToUrlMap,
        },
      })
    }
    case ConfigGen.setNotifySound:
      return state.merge({notifySound: action.payload.sound})
    case ConfigGen.setOpenAtLogin:
      return state.merge({openAtLogin: action.payload.open})
    case 'remote:updateMenubarWindowID':
      return state.merge({menubarWindowID: action.payload.id})
    case ConfigGen.setAccounts:
      return state.merge({
        configuredAccounts: I.List(action.payload.usernames),
        defaultUsername: action.payload.defaultUsername,
      })
    case ConfigGen.setDeletedSelf:
      return state.merge({justDeletedSelf: action.payload.deletedUsername})
    case ConfigGen.daemonHandshakeDone:
      return state.merge({daemonHandshakeState: 'done'})
    // Saga only actions
    case ConfigGen.loadTeamAvatars:
    case ConfigGen.loadAvatars:
    case ConfigGen.dumpLogs:
    case ConfigGen.link:
    case ConfigGen.mobileAppState:
    case ConfigGen.openAppSettings:
    case ConfigGen.showMain:
    case ConfigGen.setupEngineListeners:
    case ConfigGen.installerRan:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
