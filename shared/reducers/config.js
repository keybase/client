/* @flow */

import * as Constants from '../constants/config'
import * as CommonConstants from '../constants/common'

import type {Action} from '../constants/types/flux'
import type {Config, GetCurrentStatusRes, ExtendedStatus} from '../constants/types/flow-types'

export type ConfigState = {
  status: ?GetCurrentStatusRes,
  config: ?Config,
  extendedConfig: ?ExtendedStatus,
  username: ?string,
  uid: ?string,
  loggedIn: boolean,
  kbfsPath: string,
  error: ?any,
  devConfig: ?any,
  bootstrapTriesRemaining: number,
  bootstrapped: number,
  followers: {[key: string]: true},
  following: {[key: string]: true},
}

const initialState: ConfigState = {
  status: null,
  config: null,
  extendedConfig: null,
  username: null,
  uid: null,
  loggedIn: false,
  kbfsPath: Constants.defaultKBFSPath,
  error: null,
  devConfig: null,
  bootstrapTriesRemaining: Constants.MAX_BOOTSTRAP_TRIES,
  bootstrapped: 0,
  followers: {},
  following: {},
}

export default function (state: ConfigState = initialState, action: Action): ConfigState {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

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

    case Constants.statusLoaded:
      if (action.payload && action.payload.status) {
        const status = action.payload.status
        return {
          ...state,
          status,
          username: status.user && status.user.username,
          uid: status.user && status.user.uid,
          loggedIn: status.loggedIn,
        }
      }
      return state
    case Constants.devConfigLoading:
      return {
        ...state,
        devConfig: null,
      }
    case Constants.devConfigLoaded:
      return {
        ...state,
        devConfig: action.payload.devConfig,
      }
    case Constants.devConfigSaved:
      return {
        ...state,
        devConfig: null,
      }
    case Constants.devConfigUpdate:
      const devConfigured = state.devConfig && state.devConfig.configured || {}
      return {
        ...state,
        devConfig: {
          ...state.devConfig,
          configured: {
            ...devConfigured,
            ...action.payload.updates,
          },
        },
      }

    case Constants.bootstrapFailed: {
      return {
        ...state,
        bootstrapTriesRemaining: state.bootstrapTriesRemaining - 1,
      }
    }

    case Constants.bootstrapped: {
      return {
        ...state,
        bootstrapTriesRemaining: Constants.MAX_BOOTSTRAP_TRIES,
        bootstrapped: state.bootstrapped + 1,
      }
    }

    case Constants.updateFollowing: {
      return {
        ...state,
        following: action.payload.following,
      }
    }
    case Constants.updateFollowers: {
      return {
        ...state,
        followers: action.payload.followers,
      }
    }

    default:
      return state
  }
}
