/* @flow */

import * as Constants from '../constants/config'
import * as CommonConstants from '../constants/common'

import type {Action} from '../constants/types/flux'
import type {Config, GetCurrentStatusRes, ExtendedStatus} from '../constants/types/flow-types'

export type ConfigState = {
  status: ?GetCurrentStatusRes;
  config: ?Config;
  extendedConfig: ?ExtendedStatus;
  username: ?string;
  loggedIn: boolean,
  kbfsPath: string;
  error: ?any;
  devConfig: ?any;
  bootstrapped: number;
}

const initialState: ConfigState = {
  status: null,
  config: null,
  extendedConfig: null,
  username: null,
  loggedIn: false,
  kbfsPath: Constants.defaultKBFSPath,
  error: null,
  devConfig: null,
  bootstrapped: 0,
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

    case Constants.bootstrapped: {
      return {
        ...state,
        bootstrapped: state.bootstrapped + 1,
      }
    }
    default:
      return state
  }
}
