// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as Types from '../constants/types/config'
import * as Constants from '../constants/config'
import * as ConfigGen from '../actions/config-gen'

const initialState = Constants.makeState()

export default function(
  state: Types.State = initialState,
  action:
    | ConfigGen.Actions
    | ConfigGen.ChangedFocusPayload
    | ConfigGen.ChangedActivePayload
    | {type: 'remote:updateMenubarWindowID', payload: {id: number}}
): Types.State {
  switch (action.type) {
    case ConfigGen.resetStore:
      return initialState.merge({
        daemonHandshakeWaiters: state.daemonHandshakeWaiters,
        menubarWindowID: state.menubarWindowID,
        readyForBootstrap: state.readyForBootstrap,
      })
    case ConfigGen.startHandshake:
      return state.set('daemonError', null)
    case ConfigGen.daemonHandshakeWait: {
      const oldCount = state.daemonHandshakeWaiters.get(action.payload.name, 0)
      const newCount = oldCount + (action.payload.increment ? 1 : -1)
      if (newCount === 0) {
        return state.deleteIn(['daemonHandshakeWaiters', action.payload.name])
      }
      return state.setIn(['daemonHandshakeWaiters', action.payload.name], newCount)
    }
    case ConfigGen.pushLoaded:
      return state.set('pushLoaded', action.payload.pushLoaded)
    case ConfigGen.extendedConfigLoaded:
      return state.set('extendedConfig', action.payload.extendedConfig)
    case ConfigGen.changeKBFSPath:
      return state.set('kbfsPath', action.payload.kbfsPath)
    case ConfigGen.readyForBootstrap:
      return state.set('readyForBootstrap', true)
    case ConfigGen.bootstrapSuccess:
      return state.set('bootStatus', 'bootStatusBootstrapped')
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
    case ConfigGen.bootstrapAttemptFailed:
      return state.set('bootstrapTriesRemaining', state.bootstrapTriesRemaining - 1)
    case ConfigGen.bootstrapFailed:
      return state.set('bootStatus', 'bootStatusFailure')
    case ConfigGen.bootstrapRetry:
      return state
        .set('bootStatus', 'bootStatusLoading')
        .set('bootstrapTriesRemaining', Constants.maxBootstrapTries)
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
      return state.set('globalError', globalError)
    }
    case ConfigGen.debugDump:
      return state.set('debugDump', action.payload.items)
    case ConfigGen.daemonError: {
      const {daemonError} = action.payload
      if (daemonError) {
        logger.error('Error (daemon):', daemonError)
      }
      return state.set('daemonError', daemonError)
    }
    case ConfigGen.setInitialState:
      return state.set('initialState', action.payload.initialState)
    case ConfigGen.changedFocus:
      return state
        .set('appFocused', action.payload.appFocused)
        .set('appFocusedCount', state.appFocusedCount + 1)
    case ConfigGen.changedActive:
      return state.set('userActive', action.payload.userActive)
    case ConfigGen.loadedAvatars: {
      const {nameToUrlMap} = action.payload
      return state.set('avatars', {
        ...state.avatars,
        ...nameToUrlMap,
      })
    }
    case ConfigGen.setNotifySound:
      return state.set('notifySound', action.payload.sound)
    case ConfigGen.setOpenAtLogin:
      return state.set('openAtLogin', action.payload.open)
    case 'remote:updateMenubarWindowID':
      return state.set('menubarWindowID', action.payload.id)
    case ConfigGen.setStartedDueToPush:
      return state.set('startedDueToPush', true)
    case ConfigGen.configLoaded:
      return state.merge({
        version: action.payload.version,
        versionShort: action.payload.versionShort,
      })

    // Saga only actions
    case ConfigGen.loadTeamAvatars:
    case ConfigGen.loadAvatars:
    case ConfigGen.bootstrap:
    case ConfigGen.clearRouteState:
    case ConfigGen.getExtendedStatus:
    case ConfigGen.persistRouteState:
    case ConfigGen.retryBootstrap:
    case ConfigGen.dumpLogs:
    case ConfigGen.link:
    case ConfigGen.mobileAppState:
    case ConfigGen.openAppSettings:
    case ConfigGen.showMain:
    case ConfigGen.setupEngineListeners:
    case ConfigGen.daemonHandshake:
    case ConfigGen.installerRan:
    case ConfigGen.daemonHandshakeDone:
    case ConfigGen.registerIncomingHandlers:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
