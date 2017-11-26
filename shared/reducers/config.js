// @flow
import * as Types from '../constants/types/config'
import * as Constants from '../constants/config'
import * as ConfigGen from '../actions/config-gen'
import * as AppGen from '../actions/app-gen'

function arrayToObjectSet(arr: ?Array<string>): {[key: string]: true} {
  if (!arr) {
    return {}
  }

  return arr.reduce((obj, key) => {
    obj[key] = true
    return obj
  }, {})
}

export default function(
  state: Types.State = Constants.initialState,
  action: ConfigGen.Actions | AppGen.ChangedFocusPayload | AppGen.ChangedActivePayload
): Types.State {
  switch (action.type) {
    case ConfigGen.resetStore:
      return {
        ...Constants.initialState,
        readyForBootstrap: state.readyForBootstrap,
      }
    case ConfigGen.pushLoaded: {
      const {pushLoaded} = action.payload
      return {
        ...state,
        pushLoaded,
      }
    }
    case ConfigGen.configLoaded:
      const {config} = action.payload
      return {
        ...state,
        config,
      }
    case ConfigGen.extendedConfigLoaded:
      const {extendedConfig} = action.payload
      return {
        ...state,
        extendedConfig,
      }
    case ConfigGen.changeKBFSPath:
      const {kbfsPath} = action.payload
      return {
        ...state,
        kbfsPath,
      }
    case ConfigGen.readyForBootstrap: {
      return {
        ...state,
        readyForBootstrap: true,
      }
    }
    case ConfigGen.bootstrapSuccess: {
      return {
        ...state,
        bootStatus: 'bootStatusBootstrapped',
      }
    }
    case ConfigGen.bootstrapStatusLoaded:
      const {
        bootstrapStatus: {followers: followersArray, following: followingArray, ...bootstrapStatus},
      } = action.payload
      const followers = arrayToObjectSet(followersArray)
      const following = arrayToObjectSet(followingArray)
      return {
        ...state,
        ...bootstrapStatus,
        followers,
        following,
      }
    case ConfigGen.bootstrapAttemptFailed: {
      return {
        ...state,
        bootstrapTriesRemaining: state.bootstrapTriesRemaining - 1,
      }
    }
    case ConfigGen.bootstrapFailed: {
      return {
        ...state,
        bootStatus: 'bootStatusFailure',
      }
    }
    case ConfigGen.bootstrapRetry: {
      return {
        ...state,
        bootStatus: 'bootStatusLoading',
        bootstrapTriesRemaining: Constants.maxBootstrapTries,
      }
    }
    case ConfigGen.updateFollowing: {
      const {username, isTracking} = action.payload
      return {
        ...state,
        following: {
          ...state.following,
          [username]: isTracking,
        },
      }
    }
    case ConfigGen.globalError: {
      const {globalError} = action.payload
      if (globalError) {
        console.warn('Error (global):', globalError)
      }
      return {
        ...state,
        globalError,
      }
    }
    case ConfigGen.daemonError: {
      const {daemonError} = action.payload
      if (daemonError) {
        console.warn('Error (daemon):', daemonError)
      }
      return {
        ...state,
        daemonError,
      }
    }
    case ConfigGen.setInitialState: {
      const {initialState} = action.payload
      return {
        ...state,
        initialState,
      }
    }
    case AppGen.changedFocus:
      const {appFocused} = action.payload
      return {
        ...state,
        appFocused,
        appFocusedCount: state.appFocusedCount + 1,
      }
    case AppGen.changedActive:
      const {userActive} = action.payload
      return {
        ...state,
        userActive,
      }
    default:
      return state
  }
}
