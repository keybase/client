// @flow
import * as Constants from '../constants/config'
import * as CommonConstants from '../constants/common'
import {isMobile} from '../constants/platform'

import type {Tab} from '../constants/tabs'
import type {Action} from '../constants/types/flux'
import type {BootStatus} from '../constants/config'
import type {Config, DeviceID, GetCurrentStatusRes, ExtendedStatus} from '../constants/types/flow-types'

export type ConfigState = {
  appFocused: boolean,
  bootStatus: BootStatus,
  bootstrapTriesRemaining: number,
  config: ?Config,
  daemonError: ?Error,
  error: ?any,
  extendedConfig: ?ExtendedStatus,
  followers: {[key: string]: true},
  following: {[key: string]: true},
  globalError: ?Error,
  kbfsPath: string,
  launchedViaPush: boolean,
  loggedIn: boolean,
  registered: boolean,
  readyForBootstrap: boolean,
  status: ?GetCurrentStatusRes,
  uid: ?string,
  username: ?string,
  initialTab: ?Tab,
  deviceID: ?DeviceID,
  deviceName: ?string,
}

// Mobile is ready for bootstrap automatically, desktop needs to wait for
// the installer.
const readyForBootstrap = isMobile

const initialState: ConfigState = {
  appFocused: false,
  bootStatus: 'bootStatusLoading',
  bootstrapTriesRemaining: Constants.MAX_BOOTSTRAP_TRIES,
  config: null,
  daemonError: null,
  error: null,
  extendedConfig: null,
  followers: {},
  following: {},
  globalError: null,
  initialTab: null,
  kbfsPath: Constants.defaultKBFSPath,
  launchedViaPush: false,
  loggedIn: false,
  registered: false,
  readyForBootstrap,
  status: null,
  uid: null,
  username: null,
  deviceID: null,
  deviceName: null,
}

function arrayToObjectSet (arr) {
  if (!arr) {
    return {}
  }

  return arr.reduce((obj, key) => {
    obj[key] = true
    return obj
  }, {})
}

export default function (state: ConfigState = initialState, action: Action): ConfigState {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {
        ...initialState,
        readyForBootstrap: state.readyForBootstrap,
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
    case Constants.statusLoaded:
      if (action.payload && action.payload.status) {
        const status = action.payload.status
        return {
          ...state,
          status,
        }
      }
      return state

    case Constants.bootstrapLoaded:
      const {bootstrapStatus} = action.payload
      return {
        ...state,
        ...bootstrapStatus,
        following: arrayToObjectSet(bootstrapStatus.following),
        followers: arrayToObjectSet(bootstrapStatus.followers),
        bootStatus: 'bootStatusBootstrapped',
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

    case Constants.setLaunchedViaPush: {
      return {
        ...state,
        launchedViaPush: action.payload,
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

    case 'config:setInitialTab': {
      return {
        ...state,
        initialTab: action.payload.tab,
      }
    }

    case 'app:changedFocus':
      return {
        ...state,
        appFocused: action.payload.appFocused,
      }

    default:
      return state
  }
}
