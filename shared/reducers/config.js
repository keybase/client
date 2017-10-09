// @flow
import * as Constants from '../constants/config'
import * as CommonConstants from '../constants/common'
import {isMobile} from '../constants/platform'

import type {Action} from '../constants/types/flux'

// Mobile is ready for bootstrap automatically, desktop needs to wait for
// the installer.
const readyForBootstrap = isMobile

const initialState: Constants.State = {
  appFocused: true,
  userActive: true,
  appFocusedCount: 0,
  bootStatus: 'bootStatusLoading',
  pushLoaded: false,
  bootstrapTriesRemaining: Constants.MAX_BOOTSTRAP_TRIES,
  config: null,
  daemonError: null,
  error: null,
  extendedConfig: null,
  followers: {},
  following: {},
  globalError: null,
  initialState: null,
  kbfsPath: Constants.defaultKBFSPath,
  loggedIn: false,
  registered: false,
  readyForBootstrap,
  uid: null,
  username: null,
  deviceID: null,
  deviceName: null,
}

function arrayToObjectSet(arr) {
  if (!arr) {
    return {}
  }

  return arr.reduce((obj, key) => {
    obj[key] = true
    return obj
  }, {})
}

export default function(state: Constants.State = initialState, action: Action): Constants.State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {
        ...initialState,
        readyForBootstrap: state.readyForBootstrap,
      }
    case 'config:pushLoaded': {
      return {
        ...state,
        pushLoaded: action.payload,
      }
    }

    case Constants.configLoaded:
      if (action.payload && action.payload.config) {
        return {
          ...state,
          config: action.payload.config,
        }
      }
      return state

    case Constants.extendedConfigLoaded:
      if (action.payload && action.payload.extendedConfig) {
        return {
          ...state,
          extendedConfig: action.payload.extendedConfig,
        }
      }
      return state

    case Constants.changeKBFSPath:
      if (action.payload && action.payload.path) {
        return {
          ...state,
          kbfsPath: action.payload.path,
        }
      }
      return state

    case 'config:readyForBootstrap': {
      return {
        ...state,
        readyForBootstrap: true,
      }
    }

    case Constants.bootstrapSuccess: {
      return {
        ...state,
        bootStatus: 'bootStatusBootstrapped',
      }
    }

    case Constants.bootstrapStatusLoaded:
      const {bootstrapStatus} = action.payload
      return {
        ...state,
        ...bootstrapStatus,
        following: arrayToObjectSet(bootstrapStatus.following),
        followers: arrayToObjectSet(bootstrapStatus.followers),
      }

    case Constants.bootstrapAttemptFailed: {
      return {
        ...state,
        bootstrapTriesRemaining: state.bootstrapTriesRemaining - 1,
      }
    }

    case Constants.bootstrapFailed: {
      return {
        ...state,
        bootStatus: 'bootStatusFailure',
      }
    }

    case Constants.bootstrapRetry: {
      return {
        ...state,
        bootStatus: 'bootStatusLoading',
        bootstrapTriesRemaining: Constants.MAX_BOOTSTRAP_TRIES,
      }
    }

    case Constants.updateFollowing: {
      const {username, isTracking} = action.payload
      return {
        ...state,
        following: {
          ...state.following,
          [username]: isTracking,
        },
      }
    }

    case Constants.globalErrorDismiss: {
      return {
        ...state,
        globalError: null,
      }
    }
    case Constants.globalError: {
      const error = action.payload
      if (error) {
        console.warn('Error (global):', error)
      }
      return {
        ...state,
        globalError: error,
      }
    }
    case Constants.daemonError: {
      const error = action.payload.daemonError
      if (error) {
        console.warn('Error (daemon):', error)
      }
      return {
        ...state,
        daemonError: error,
      }
    }

    case 'config:setInitialState': {
      return {
        ...state,
        initialState: action.payload,
      }
    }

    case 'app:changedFocus':
      return {
        ...state,
        appFocused: action.payload.appFocused,
        appFocusedCount: state.appFocusedCount + 1,
      }

    case 'app:changedActive':
      return {
        ...state,
        userActive: action.payload.userActive,
      }

    default:
      return state
  }
}
