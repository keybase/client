// @flow
import * as I from 'immutable'
import * as Types from '../constants/types/config'
import * as Constants from '../constants/config'
import * as ConfigGen from '../actions/config-gen'
import * as AppGen from '../actions/app-gen'
import isEmpty from 'lodash/isEmpty'
import pickBy from 'lodash/pickBy'

const initialState = Constants.makeState()

export default function(
  state: Types.State = initialState,
  action:
    | ConfigGen.Actions
    | AppGen.ChangedFocusPayload
    | AppGen.ChangedActivePayload
    | {type: 'remote:updateMenubarWindowID', payload: {id: number}}
): Types.State {
  switch (action.type) {
    case ConfigGen.resetStore:
      return initialState
        .set('readyForBootstrap', state.readyForBootstrap)
        .set('menubarWindowID', state.menubarWindowID)
    case ConfigGen.pushLoaded:
      return state.set('pushLoaded', action.payload.pushLoaded)
    case ConfigGen.configLoaded:
      return state.set('config', action.payload.config)
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
        console.warn('Error (global):', globalError)
      }
      return state.set('globalError', globalError)
    }
    case ConfigGen.daemonError: {
      const {daemonError} = action.payload
      if (daemonError) {
        console.warn('Error (daemon):', daemonError)
      }
      return state.set('daemonError', daemonError)
    }
    case ConfigGen.setInitialState:
      return state.set('initialState', action.payload.initialState)
    case AppGen.changedFocus:
      return state
        .set('appFocused', action.payload.appFocused)
        .set('appFocusedCount', state.appFocusedCount + 1)
    case AppGen.changedActive:
      return state.set('userActive', action.payload.userActive)
    case ConfigGen.clearAvatarCache: {
      const old = state.avatars
      const goodAvatars = pickBy(old, value => !isEmpty(value))

      if (Object.keys(old).length === Object.keys(goodAvatars).length) {
        return state
      } else {
        // Something errored?
        return state.set('avatars', goodAvatars)
      }
    }
    case ConfigGen.loadedAvatars: {
      const {nameToUrlMap} = action.payload
      return state.set('avatars', {
        ...state.avatars,
        ...nameToUrlMap,
      })
    }
    case 'remote:updateMenubarWindowID':
      return state.set('menubarWindowID', action.payload.id)
    // Saga only actions
    case ConfigGen.loadTeamAvatars:
    case ConfigGen.loadAvatars:
    case ConfigGen.bootstrap:
    case ConfigGen.clearRouteState:
    case ConfigGen.getExtendedStatus:
    case ConfigGen.persistRouteState:
    case ConfigGen.retryBootstrap:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
