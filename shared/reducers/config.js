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
      return initialState
        .set('readyForBootstrap', state.readyForBootstrap)
        .set('menubarWindowID', state.menubarWindowID)
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
      return state
        .set('deviceID', action.payload.deviceID)
        .set('deviceName', action.payload.deviceName)
        .set('followers', I.Set(action.payload.followers || []))
        .set('following', I.Set(action.payload.following || []))
        .set('loggedIn', action.payload.loggedIn)
        .set('registered', action.payload.registered)
        .set('uid', action.payload.uid)
        .set('username', action.payload.username)
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
    case ConfigGen.setOpenAtLogin:
      return state.set('openAtLogin', action.payload.open)
    case 'remote:updateMenubarWindowID':
      return state.set('menubarWindowID', action.payload.id)
    case ConfigGen.setStartedDueToPush:
      return state.set('startedDueToPush', true)
    case ConfigGen.configLoaded:
      const {config} = action.payload
      return state.set('version', config.version).set('versionShort', config.versionShort)
    // Saga only actions
    case ConfigGen.loadTeamAvatars:
    case ConfigGen.loadAvatars:
    case ConfigGen.bootstrap:
    case ConfigGen.clearRouteState:
    case ConfigGen.getExtendedStatus:
    case ConfigGen.persistRouteState:
    case ConfigGen.retryBootstrap:
    case ConfigGen.loadConfig:
    case ConfigGen.dumpLogs:
    case ConfigGen.link:
    case ConfigGen.mobileAppState:
    case ConfigGen.showMain:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
